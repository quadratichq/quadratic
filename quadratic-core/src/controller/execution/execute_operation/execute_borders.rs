use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::sheet::borders::BorderStyleCellUpdate,
    selection::OldSelection, Pos, RunLengthEncoding,
};

impl GridController {
    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_borders_a1()`].
    pub fn execute_set_borders(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetBorders { sheet_rect, borders } = op);

        let selection = OldSelection::sheet_rect(sheet_rect);
        let mut borders_new = RunLengthEncoding::new();

        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                if let Some(original) = borders.per_cell.try_get_cell_border(Pos { x, y }) {
                    borders_new.push(BorderStyleCellUpdate {
                        top: original.borders[1].map(|b| Some(b.into())),
                        bottom: original.borders[3].map(|b| Some(b.into())),
                        left: original.borders[0].map(|b| Some(b.into())),
                        right: original.borders[2].map(|b| Some(b.into())),
                    });
                } else {
                    borders_new.push(BorderStyleCellUpdate::default());
                }
            }
        }

        // We add the new borders operation to the front of the list so it's next.
        transaction
            .operations
            .push_front(Operation::SetBordersSelection {
                selection,
                borders: borders_new,
            });
    }

    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_borders_a1()`].
    pub fn execute_set_borders_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetBordersSelection { selection, borders } = op);

        if self.thumbnail_dirty_selection(&selection) {
            transaction.generate_thumbnail = true;
        }

        let Some(sheet) = self.try_sheet_mut(selection.sheet_id) else {
            return; // sheet may have been deleted
        };

        transaction
            .reverse_operations
            .extend(sheet.borders.set_borders_selection(&selection, &borders));

        // Do not finitize selection; borders actually *does* treat the sheet as
        // infinite.
        transaction
            .forward_operations
            .push(Operation::SetBordersSelection {
                selection: selection.clone(),
                borders,
            });

        transaction.sheet_borders.insert(selection.sheet_id);
    }

    pub fn execute_set_borders_a1(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetBordersA1 { sheet_id, subspaces, borders } = op);

        transaction.generate_thumbnail |= self.thumbnail_dirty_subspaces(sheet_id, &subspaces);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        transaction
            .reverse_operations
            .extend(sheet.borders.set_borders_a1(&subspaces, &borders));

        // Do not finitize selection; borders actually *does* treat the sheet as
        // infinite.
        transaction
            .forward_operations
            .push(Operation::SetBordersA1 {
                sheet_id,
                subspaces: subspaces.clone(),
                borders,
            });

        transaction.sheet_borders.insert(sheet_id);
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;
    use uuid::Uuid;

    use crate::{
        color::Rgba, controller::active_transactions::unsaved_transactions::UnsavedTransaction,
        grid::sheet::borders::CellBorderLine,
    };

    use super::*;

    /// This test is only needed for offline transactions during the
    /// transition to the new borders operation.
    #[test]
    #[parallel]
    fn test_old_borders_operation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        // captured data from a 1.6 offline borders transaction
        let transaction_id = "ed01d8a2-b00d-489b-ba3e-c7af028c6ae5".to_string();
        let transaction = r#"{"forward":{"id":"ed01d8a2-b00d-489b-ba3e-c7af028c6ae5","sequence_num":null,"operations":[{"SetBorders":{"sheet_rect":{"min":{"x":2,"y":3},"max":{"x":3,"y":4},"sheet_id":{"id":"00000000-0000-0000-0000-000000000000"}},"borders":{"per_cell":{"3":{"2":{"y":2,"content":{"value":{"borders":[null,null,null,{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"}]},"len":1}},"3":{"y":3,"content":{"value":{"borders":[{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"}]},"len":1}},"4":{"y":4,"content":{"value":{"borders":[{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"}]},"len":1}},"5":{"y":5,"content":{"value":{"borders":[null,{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},null,null]},"len":1}}},"1":{"3":{"y":3,"content":{"value":{"borders":[null,null,{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},null]},"len":2}}},"2":{"2":{"y":2,"content":{"value":{"borders":[null,null,null,{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"}]},"len":1}},"3":{"y":3,"content":{"value":{"borders":[{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"}]},"len":1}},"4":{"y":4,"content":{"value":{"borders":[{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"}]},"len":1}},"5":{"y":5,"content":{"value":{"borders":[null,{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},null,null]},"len":1}}},"4":{"3":{"y":3,"content":{"value":{"borders":[{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},null,null,null]},"len":2}}}},"render_lookup":{"vertical":{"3":{"3":{"y":3,"content":{"value":{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},"len":2}}},"2":{"3":{"y":3,"content":{"value":{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},"len":2}}},"4":{"3":{"y":3,"content":{"value":{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},"len":2}}}},"horizontal":{"3":{"2":{"y":2,"content":{"value":{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},"len":2}}},"4":{"2":{"y":2,"content":{"value":{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},"len":2}}},"5":{"2":{"y":2,"content":{"value":{"color":{"red":0,"green":0,"blue":0,"alpha":1},"line":"line1"},"len":2}}}}}}}}],"cursor":null},"reverse":{"id":"ed01d8a2-b00d-489b-ba3e-c7af028c6ae5","sequence_num":null,"operations":[{"SetBorders":{"sheet_rect":{"min":{"x":2,"y":3},"max":{"x":3,"y":4},"sheet_id":{"id":"f2a3a6d2-6601-4a69-8868-19d565408e9b"}},"borders":{"per_cell":{"2":{},"3":{}},"render_lookup":{"vertical":{"3":{},"2":{},"4":{}},"horizontal":{"5":{},"4":{},"3":{}}}}}}],"cursor":"{\"sheetId\":\"f2a3a6d2-6601-4a69-8868-19d565408e9b\",\"keyboardMovePosition\":{\"x\":3,\"y\":4},\"cursorPosition\":{\"x\":2,\"y\":3},\"multiCursor\":[{\"x\":2,\"y\":3,\"width\":2,\"height\":2}]}"},"sent_to_server":false}"#.to_string();

        // copied from js_apply_offline_unsaved_transaction (can't run wasm ops in tests)
        let transaction_id = Uuid::parse_str(&transaction_id).unwrap();
        let unsaved_transaction = serde_json::from_str::<UnsavedTransaction>(&transaction).unwrap();
        gc.apply_offline_unsaved_transaction(transaction_id, unsaved_transaction);

        let sheet = gc.sheet(sheet_id);

        let js_borders = sheet.borders.borders_in_sheet().unwrap();
        let horizontal = js_borders.horizontal.unwrap();
        let vertical = js_borders.vertical.unwrap();

        assert_eq!(vertical.len(), 3);
        assert_eq!(horizontal.len(), 3);

        assert_eq!(vertical[0].x, 2);
        assert_eq!(vertical[0].y, 3);
        assert_eq!(vertical[0].height, 2);
        assert_eq!(vertical[0].line, CellBorderLine::Line1);
        assert_eq!(
            vertical[0].color,
            Rgba {
                red: 0,
                green: 0,
                blue: 0,
                alpha: 255,
            }
        );

        assert_eq!(horizontal[0].x, 2);
        assert_eq!(horizontal[0].y, 3);
        assert_eq!(horizontal[0].width, 2);
        assert_eq!(horizontal[0].line, CellBorderLine::Line1);
        assert_eq!(
            horizontal[0].color,
            Rgba {
                red: 0,
                green: 0,
                blue: 0,
                alpha: 255,
            }
        );
    }
}
