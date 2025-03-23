use crate::{
    CopyFormats, Pos,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{GridBounds, Sheet},
};

impl Sheet {
    /// Removes any value at row and shifts the remaining values up by 1.
    fn insert_and_shift_values(&mut self, row: i64) {
        // use the sheet bounds to determine the approximate bounds for the impacted range
        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    let mut keys_to_move: Vec<i64> = column
                        .values
                        .keys()
                        .filter(|&key| *key >= row)
                        .cloned()
                        .collect();

                    keys_to_move.sort_unstable_by(|a, b| b.cmp(a));

                    // Move down values
                    for key in keys_to_move {
                        if let Some(value) = column.values.remove(&key) {
                            column.values.insert(key + 1, value);
                        }
                    }
                }
            }
        }
    }

    pub(crate) fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        copy_formats: CopyFormats,
        send_client: bool,
    ) {
        // mark hashes of existing rows dirty
        if send_client {
            transaction.add_dirty_hashes_from_sheet_rows(self, row, None);
        }

        self.insert_and_shift_values(row);

        // update formatting
        self.formats.insert_row(row, copy_formats);
        if send_client {
            transaction.add_fill_cells(self.id);
        }

        // signal client to update the borders for changed columns
        self.borders.insert_row(row, copy_formats);
        if send_client {
            transaction.sheet_borders.insert(self.id);
        }

        // update the indices of all code_runs impacted by the insertion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.data_tables.iter() {
            if pos.y >= row {
                code_runs_to_move.push(*pos);
            }
        }
        code_runs_to_move.sort_by(|a, b| b.y.cmp(&a.y));
        for old_pos in code_runs_to_move {
            let new_pos = Pos {
                x: old_pos.x,
                y: old_pos.y + 1,
            };
            if let Some(code_run) = self.data_tables.shift_remove(&old_pos) {
                // signal html and image cells to update
                if send_client {
                    if code_run.is_html() {
                        transaction.add_html_cell(self.id, old_pos);
                        transaction.add_html_cell(self.id, new_pos);
                    } else if code_run.is_image() {
                        transaction.add_image_cell(self.id, old_pos);
                        transaction.add_image_cell(self.id, new_pos);
                    }
                }

                self.data_tables.insert_sorted(new_pos, code_run);

                // signal the client to updates to the code cells (to draw the code arrays)
                transaction.add_code_cell(self.id, old_pos);
                transaction.add_code_cell(self.id, new_pos);
            }
        }

        // mark hashes of new rows dirty
        if send_client {
            transaction.add_dirty_hashes_from_sheet_rows(self, row, None);
        }

        let changed_selections =
            self.validations
                .insert_row(transaction, self.id, row, &self.a1_context());
        if send_client {
            transaction.add_dirty_hashes_from_selections(
                self,
                &self.a1_context(),
                changed_selections,
            );
        }

        let changes = self.offsets.insert_row(row);
        if send_client && !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, None, Some(*index), Some(*size));
            });
        }

        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the row (this will also shift all impacted rows)
            transaction.reverse_operations.push(Operation::DeleteRow {
                sheet_id: self.id,
                row,
            });
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, DEFAULT_ROW_HEIGHT,
        grid::sheet::borders::{BorderSide, BorderStyleCell, BorderStyleTimestamp, CellBorderLine},
    };

    use super::*;

    #[test]
    fn insert_row_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);
        sheet.borders.set_style_cell(
            pos![A1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![A2],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![A3],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.test_set_code_run_array(4, 1, vec!["A", "B"], false);

        sheet.recalculate_bounds();

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 1, CopyFormats::None, false);

        assert_eq!(sheet.display_value(pos![A1]), None);
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![A4]),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![A1]), None);
        assert_eq!(
            sheet
                .borders
                .get_side(BorderSide::Top, pos![A2])
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![A3]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![A4]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![E1]), None);

        assert!(sheet.data_tables.get(&pos![D1]).is_none());
        assert!(sheet.data_tables.get(&pos![D2]).is_some());

        assert_eq!(
            sheet.display_value(pos![D2]),
            Some(CellValue::Text("A".to_string()))
        );
    }

    #[test]
    fn insert_row_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 2, CopyFormats::None, false);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 4 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    fn insert_row_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 2, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 3, CopyFormats::None, false);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 3 }), None);
    }

    #[test]
    fn insert_row_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.insert_row(&mut transaction, 2, CopyFormats::None, false);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 200.0);
        assert_eq!(sheet.offsets.row_height(5), 400.0);
    }
}
