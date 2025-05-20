use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::{Pos, SheetRect};

impl GridController {
    pub(crate) fn execute_set_cell_values(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCellValues { sheet_pos, values } = op {
            match self.grid.try_sheet_mut(sheet_pos.sheet_id) {
                None => (), // sheet may have been deleted
                Some(sheet) => {
                    // update individual cell values and collect old_values
                    let old_values = sheet.merge_cell_values(
                        transaction,
                        sheet_pos.into(),
                        &values,
                        !transaction.is_server(),
                        &self.a1_context,
                    );

                    if old_values == values {
                        return;
                    }

                    let min = sheet_pos.into();
                    let sheet_rect = SheetRect {
                        sheet_id: sheet_pos.sheet_id,
                        min,
                        max: Pos {
                            x: min.x - 1 + values.w as i64,
                            y: min.y - 1 + values.h as i64,
                        },
                    };
                    if transaction.is_user_undo_redo() {
                        transaction
                            .forward_operations
                            .push(Operation::SetCellValues { sheet_pos, values });

                        if transaction.is_user() {
                            self.check_deleted_data_tables(transaction, &sheet_rect);
                            self.add_compute_operations(transaction, &sheet_rect, None);
                            self.check_all_spills(transaction, sheet_rect.sheet_id);
                        }

                        transaction
                            .reverse_operations
                            .push(Operation::SetCellValues {
                                sheet_pos,
                                values: old_values,
                            });
                    }

                    transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(sheet_rect);

                    self.send_updated_bounds(transaction, sheet_rect.sheet_id);
                    if !transaction.is_server() {
                        transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);

                        if transaction.is_user() {
                            if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
                                let rows =
                                    sheet.get_rows_with_wrap_in_rect(&sheet_rect.into(), true);
                                if !rows.is_empty() {
                                    let resize_rows = transaction
                                        .resize_rows
                                        .entry(sheet_pos.sheet_id)
                                        .or_default();
                                    resize_rows.extend(rows);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use bigdecimal::BigDecimal;

    use crate::controller::GridController;
    use crate::grid::{CodeCellLanguage, SheetId};
    use crate::{CellValue, Pos, SheetPos};

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
        gc.set_cell_value(
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

        let no_sheet_id = SheetId::new();
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id: no_sheet_id,
            },
            "test 2".to_string(),
            None,
        );
    }

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
        gc.set_cell_value(sheet_pos, "1".to_string(), None);
        assert_eq!(
            gc.sheet(sheet_id).display_value(sheet_pos.into()),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
        gc.undo(None);
        assert_eq!(gc.sheet(sheet_id).display_value(sheet_pos.into()), None);
    }

    #[test]
    fn dependencies_properly_trigger_on_set_cell_values() {
        let mut gc = GridController::test();
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id: gc.sheet_ids()[0],
            },
            "1".to_string(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id: gc.sheet_ids()[0],
            },
            CodeCellLanguage::Formula,
            "A0 + 5".to_string(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: -1,
                y: 0,
                sheet_id: gc.sheet_ids()[0],
            },
            "2".to_string(),
            None,
        );
        assert_eq!(gc.active_transactions().unsaved_transactions.len(), 3);
        let last_transaction = gc
            .active_transactions()
            .unsaved_transactions
            .last()
            .unwrap();
        assert_eq!(last_transaction.forward.operations.len(), 1);
    }
}
