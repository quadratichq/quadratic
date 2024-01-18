use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    Array, CellValue,
};

impl GridController {
    pub(crate) fn execute_set_cell_values(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellValues { sheet_rect, values } = op {
            match self.grid.try_sheet_mut(sheet_rect.sheet_id) {
                None => (), // sheet may have been deleted
                Some(sheet) => {
                    // update individual cell values and collect old_values
                    let old_values = sheet_rect
                        .iter()
                        .zip(values.clone().into_cell_values_vec())
                        .map(|(sheet_pos, value)| {
                            let old_value = sheet.set_cell_value(sheet_pos.into(), value);

                            // add html to summary if old value was of that type
                            if old_value
                                .as_ref()
                                .is_some_and(|cell_value| cell_value.is_html())
                            {
                                transaction.summary.html.insert(sheet_pos.sheet_id);
                            }
                            old_value
                        })
                        .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                        .collect();

                    if transaction.is_user() || transaction.is_undo_redo() {
                        transaction
                            .forward_operations
                            .push(Operation::SetCellValues { sheet_rect, values });

                        if transaction.is_user() {
                            self.check_deleted_code_runs(transaction, &sheet_rect);
                            self.add_compute_operations(transaction, &sheet_rect, None);
                            self.check_all_spills(transaction, sheet_rect.sheet_id);
                        }

                        // create reverse_operation
                        let old_values = Array::new_row_major(sheet_rect.size(), old_values)
                            .expect(
                                "error constructing array of old values for SetCells operation",
                            );
                        transaction.reverse_operations.insert(
                            0,
                            Operation::SetCellValues {
                                sheet_rect,
                                values: old_values,
                            },
                        );
                    }
                    // prepare summary
                    transaction
                        .sheets_with_dirty_bounds
                        .insert(sheet_rect.sheet_id);
                    transaction.summary.generate_thumbnail |=
                        self.thumbnail_dirty_sheet_rect(&sheet_rect);
                    transaction
                        .summary
                        .add_cell_sheets_modified_rect(&sheet_rect);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use bigdecimal::BigDecimal;

    use crate::{controller::GridController, grid::SheetId, CellValue, Pos, SheetPos};

    #[test]
    fn test_set_cell_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "0".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(0)))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "1".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
    }

    #[test]
    fn test_set_cell_values_no_sheet() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "test".to_string(),
            None,
        );
        let sheet = gc.grid.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("test".to_string()))
        );
        assert_eq!(summary.cell_sheets_modified.len(), 1);

        let no_sheet_id = SheetId::new();
        let summary = gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id: no_sheet_id,
            },
            "test 2".to_string(),
            None,
        );
        assert_eq!(summary.cell_sheets_modified.len(), 0);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{grid::CodeCellLanguage, SheetPos};
    use bigdecimal::BigDecimal;

    #[test]
    fn test_set_cell_values_code_cell_remove() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(sheet_pos.into()),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        gc.set_cell_value(sheet_pos, "".to_string(), None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.display_value(sheet_pos.into()), None);
    }

    #[test]
    fn test_set_cell_values_undo() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let summary = gc.set_cell_value(sheet_pos, "1".to_string(), None);
        assert_eq!(
            gc.sheet(sheet_id).display_value(sheet_pos.into()),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        assert_eq!(summary.cell_sheets_modified.len(), 1);
        let summary = gc.undo(None);
        assert_eq!(summary.cell_sheets_modified.len(), 1);
        assert_eq!(gc.sheet(sheet_id).display_value(sheet_pos.into()), None);
    }
}
