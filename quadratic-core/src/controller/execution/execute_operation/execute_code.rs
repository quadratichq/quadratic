use crate::{
    CellValue, SheetPos, SheetRect,
    a1::A1Selection,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::CodeCellLanguage,
};
use anyhow::Result;
impl GridController {
    /// Adds operations to compute cells that are dependents within a SheetRect
    pub fn add_compute_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        output: SheetRect,
        skip_compute: Option<SheetPos>,
    ) {
        if !transaction.is_user_ai() {
            return;
        }

        self.get_dependent_code_cells(output)
            .iter()
            .for_each(|sheet_positions| {
                sheet_positions.iter().for_each(|code_cell_sheet_pos| {
                    if !skip_compute
                        .is_some_and(|skip_compute| skip_compute == *code_cell_sheet_pos)
                    {
                        // only add a compute operation if there isn't already one pending
                        if !transaction.operations.iter().any(|op| match op {
                            Operation::ComputeCode { sheet_pos } => {
                                code_cell_sheet_pos == sheet_pos
                            }
                            _ => false,
                        }) {
                            transaction.operations.push_back(Operation::ComputeCode {
                                sheet_pos: *code_cell_sheet_pos,
                            });
                        }
                    }
                });
            });
    }

    /// **Deprecated** and replaced with SetChartCellSize
    pub(super) fn execute_set_chart_size(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetChartSize {
            sheet_pos,
            pixel_width,
            pixel_height,
        } = op
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let original = sheet.data_table_result(&data_table_pos)?.chart_pixel_output;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.chart_pixel_output = Some((pixel_width, pixel_height));
                Ok(())
            })?;

            transaction.add_update_selection(A1Selection::table(sheet_pos, data_table.name()));

            transaction.forward_operations.push(op);
            transaction
                .reverse_operations
                .push(Operation::SetChartSize {
                    sheet_pos,
                    pixel_width: original
                        .map(|(pixel_width, _)| pixel_width)
                        .unwrap_or(pixel_width),
                    pixel_height: original
                        .map(|(_, pixel_height)| pixel_height)
                        .unwrap_or(pixel_height),
                });

            transaction.add_from_code_run(
                sheet_pos.sheet_id,
                sheet_pos.into(),
                data_table.is_image(),
                data_table.is_html(),
            );

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
        }

        Ok(())
    }

    pub(super) fn execute_set_chart_cell_size(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetChartCellSize { sheet_pos, w, h } = op {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let original = sheet.data_table_result(&data_table_pos)?.chart_output;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.chart_output = Some((w, h));
                Ok(())
            })?;

            transaction.add_update_selection(A1Selection::table(sheet_pos, data_table.name()));

            transaction.add_from_code_run(
                sheet_pos.sheet_id,
                sheet_pos.into(),
                data_table.is_image(),
                data_table.is_html(),
            );

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            if transaction.is_user_ai_undo_redo() {
                transaction.forward_operations.push(op);

                transaction
                    .reverse_operations
                    .push(Operation::SetChartCellSize {
                        sheet_pos,
                        w: original.map(|(w, _)| w).unwrap_or(w),
                        h: original.map(|(_, h)| h).unwrap_or(h),
                    });

                let sheet_rect = SheetRect::from_numbers(
                    sheet_pos.x,
                    sheet_pos.y,
                    w as i64,
                    h as i64,
                    sheet_pos.sheet_id,
                );
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(sheet_rect);
            }
        }

        Ok(())
    }

    pub(super) fn execute_compute_code(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ComputeCode { sheet_pos } = op {
            if !transaction.is_user_ai_undo_redo() && !transaction.is_server() {
                dbgjs!("Only user / undo / redo / server transaction should have a ComputeCode");
                return;
            }
            let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) else {
                // sheet may have been deleted in a multiplayer operation
                return;
            };
            if let Some(CellValue::Code(code_cell_value)) = sheet.cell_value(sheet_pos.into()) {
                match code_cell_value.language {
                    CodeCellLanguage::Python => {
                        self.run_python(transaction, sheet_pos, code_cell_value.code);
                    }
                    CodeCellLanguage::Formula => {
                        self.run_formula(transaction, sheet_pos, code_cell_value.code);
                    }
                    CodeCellLanguage::Connection { kind, id } => {
                        self.run_connection(transaction, sheet_pos, code_cell_value.code, kind, id);
                    }
                    CodeCellLanguage::Javascript => {
                        self.run_javascript(transaction, sheet_pos, code_cell_value.code);
                    }
                    CodeCellLanguage::Import => {} // no-op
                }
            }
        }
    }

    pub(super) fn execute_compute_code_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ComputeCodeSelection { selection } = op {
            let mut new_ops = Vec::new();

            // TODO: these loops are super expensive. Once we move all code to
            // data_tables, we can use the cache instead. We can't use the cache
            // now, since the cache is not populated until after the code is
            // executed.

            if let Some(selection) = selection {
                let sheet_id = selection.sheet_id;
                let Some(sheet) = self.try_sheet(sheet_id) else {
                    // sheet may have been deleted in a multiplayer operation
                    return;
                };

                // loop through the positions in the selection
                for rect in selection.rects_unbounded(self.a1_context()) {
                    sheet.columns.iter_content_in_rect(rect).for_each(|pos| {
                        if matches!(sheet.cell_value(pos), Some(CellValue::Code(_))) {
                            new_ops.push(Operation::ComputeCode {
                                sheet_pos: pos.to_sheet_pos(sheet_id),
                            });
                        }
                    });
                }
            } else {
                let sheets = self.sheets();
                for sheet in sheets {
                    sheet.columns.iter_content().for_each(|pos| {
                        if matches!(sheet.cell_value(pos), Some(CellValue::Code(_))) {
                            new_ops.push(Operation::ComputeCode {
                                sheet_pos: pos.to_sheet_pos(sheet.id),
                            });
                        }
                    });
                }
            }
            transaction.operations.extend(new_ops);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, Pos, SheetPos,
        a1::A1Selection,
        controller::{
            GridController,
            active_transactions::{
                pending_transaction::PendingTransaction, transaction_name::TransactionName,
            },
            operations::operation::Operation,
        },
        grid::CodeCellLanguage,
        wasm_bindings::js::{clear_js_calls, expect_js_call_count},
    };

    #[test]
    fn test_spilled_output_over_normal_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("one".into()));
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("two".into()));
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1:A2".to_string(),
            None,
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("one".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("two".into()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 3 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("one".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Text("two".into()))
        );

        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "cause spill".to_string(),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 2 }),
            Some(CellValue::Text("cause spill".into()))
        );

        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Blank)
        );

        let code_cell = sheet.data_table_at(&Pos { x: 2, y: 1 });
        assert!(code_cell.unwrap().has_spill());
    }

    #[test]
    fn execute_code() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Javascript,
            "code".to_string(),
            None,
            None,
            false,
        );
        expect_js_call_count("jsRunJavascript", 1, true);

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Python,
            "code".to_string(),
            None,
            None,
            false,
        );
        expect_js_call_count("jsRunPython", 1, true);

        // formula is already tested since it works solely in Rust
    }

    #[test]
    fn test_execute_set_chart_cell_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_chart(pos![A1], 3, 3);

        let mut transaction = PendingTransaction::default();
        gc.execute_set_chart_cell_size(
            &mut transaction,
            Operation::SetChartCellSize {
                sheet_pos: SheetPos {
                    x: 1,
                    y: 1,
                    sheet_id,
                },
                w: 4,
                h: 5,
            },
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_table_at(&pos![A1]).unwrap().chart_output,
            Some((4, 5))
        );
    }

    #[test]
    fn test_execute_compute_code_selection() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a single code cell for testing
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "NOW()".to_string(),
            None,
            None,
            false,
        );

        let value1 = gc.sheet(sheet_id).display_value(pos![A1]).unwrap();

        // Wait 1 second to ensure we get a different timestamp
        std::thread::sleep(std::time::Duration::from_secs(1));

        // Test execute_compute_code_selection
        let ops = vec![Operation::ComputeCodeSelection { selection: None }];
        gc.start_user_ai_transaction(ops, None, TransactionName::Unknown, false);

        let value2 = gc.sheet(sheet_id).display_value(pos![A1]).unwrap();
        assert!(value2 != value1);

        // Wait 1 second to ensure we get a different timestamp
        std::thread::sleep(std::time::Duration::from_secs(1));

        let ops = vec![Operation::ComputeCodeSelection {
            selection: Some(A1Selection::from_single_cell(pos![sheet_id!A1])),
        }];
        gc.start_user_ai_transaction(ops, None, TransactionName::Unknown, false);

        let value3 = gc.sheet(sheet_id).display_value(pos![A1]).unwrap();
        assert!(value3 != value2);

        // Wait 1 second to ensure we get a different timestamp
        std::thread::sleep(std::time::Duration::from_secs(1));

        let ops = vec![Operation::ComputeCodeSelection {
            selection: Some(A1Selection::all(sheet_id)),
        }];
        gc.start_user_ai_transaction(ops, None, TransactionName::Unknown, false);

        let value4 = gc.sheet(sheet_id).display_value(pos![A1]).unwrap();
        assert!(value4 != value3);
    }
}
