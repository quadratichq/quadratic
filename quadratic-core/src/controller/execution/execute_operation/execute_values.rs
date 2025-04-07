use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::{CellValue, Pos, SheetRect};

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

                    // if cfg!(target_family = "wasm")
                    //     && !transaction.is_server()
                    //     && values.into_iter().any(|(_, _, value)| value.is_html())
                    // {
                    //     if let Some(html) = sheet.get_single_html_output(sheet_pos.into()) {
                    //         if let Ok(html) = serde_json::to_string(&html) {
                    //             crate::wasm_bindings::js::jsUpdateHtml(html);
                    //         }
                    //     }
                    // };

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

    /// Moves a cell value from one position on a sheet to another position on
    /// the same sheet. Note: this purposefully does not check if the cell value
    /// is a data table. This should only be used to move only the CellValue
    /// without impacting any other data in the sheet.
    pub(crate) fn execute_move_cell_value(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::MoveCellValue { sheet_id, from, to } = op {
            let sheet_rect = SheetRect {
                sheet_id,
                min: Pos {
                    x: from.x.min(to.x),
                    y: from.y.min(to.y),
                },
                max: Pos {
                    x: from.x.max(to.x),
                    y: from.y.max(to.y),
                },
            };
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                sheet.move_cell_value(from, to);
                transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);
                transaction
                    .reverse_operations
                    .push(Operation::MoveCellValue {
                        sheet_id,
                        from: to,
                        to: from,
                    });
                if let Some(cell_value) = sheet.cell_value_ref(to) {
                    if matches!(cell_value, CellValue::Code(_) | CellValue::Import(_)) {
                        if let Some(table) = sheet.data_tables.get(&to) {
                            transaction.add_from_code_run(
                                sheet_id,
                                to,
                                table.is_html(),
                                table.is_image(),
                            );
                            transaction.add_from_code_run(
                                sheet_id,
                                from,
                                table.is_html(),
                                table.is_image(),
                            );
                        }
                    }
                }
            }
            if transaction.is_user() {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    let rows = sheet.get_rows_with_wrap_in_rect(&sheet_rect.into(), true);
                    if !rows.is_empty() {
                        let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                        resize_rows.extend(rows);
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
    use crate::controller::active_transactions::transaction_name::TransactionName;
    use crate::controller::operations::operation::Operation;
    use crate::grid::{CodeCellLanguage, SheetId};
    use crate::{CellValue, Pos, SheetPos, assert_display_cell_value};

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

    #[test]
    fn test_move_cell_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let from_pos = Pos { x: 1, y: 1 };
        let to_pos = Pos { x: 2, y: 2 };

        // Set initial value
        gc.set_cell_value(from_pos.to_sheet_pos(sheet_id), "test".to_string(), None);

        // Verify initial value is set
        assert_display_cell_value(&gc, sheet_id, 1, 1, "test");

        // Move the cell value
        let ops = vec![Operation::MoveCellValue {
            sheet_id,
            from: from_pos,
            to: to_pos,
        }];
        gc.start_user_transaction(ops, None, TransactionName::SetCells);

        // Verify the value was moved correctly
        assert_display_cell_value(&gc, sheet_id, 2, 2, "test");
        assert_display_cell_value(&gc, sheet_id, 1, 1, "");

        gc.undo(None);
        assert_display_cell_value(&gc, sheet_id, 1, 1, "test");
        assert_display_cell_value(&gc, sheet_id, 2, 2, "");
    }
}
