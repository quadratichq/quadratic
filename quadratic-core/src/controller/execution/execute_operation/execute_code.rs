use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::CodeCellLanguage,
    CellValue, Pos, SheetPos, SheetRect,
};
use anyhow::Result;
impl GridController {
    /// Adds operations to compute cells that are dependents within a SheetRect
    pub fn add_compute_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        output: &SheetRect,
        skip_compute: Option<SheetPos>,
    ) {
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

    pub(super) fn execute_set_code_run(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCodeRun {
            sheet_pos,
            code_run,
            index,
        } = op
        {
            let op = Operation::SetCodeRunVersion {
                sheet_pos,
                code_run,
                index,
                version: 1,
            };
            self.execute_set_code_run_version(transaction, op);
        }
    }

    pub(super) fn execute_set_code_run_version(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetCodeRunVersion {
            sheet_pos,
            code_run,
            index,
            version,
        } = op
        {
            if version == 1 {
                self.finalize_data_table(
                    transaction,
                    sheet_pos,
                    code_run.map(|code_run| code_run.into()),
                    Some(index),
                );
            } else {
                dbgjs!("Expected SetCodeRunVersion version to be 1");
            }
        }
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
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            data_table.chart_pixel_output = Some((pixel_width, pixel_height));
            let new_data_table = data_table.clone();

            self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None);
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
            let data_table = sheet.data_table_mut(sheet_pos.into())?;
            let original = data_table.chart_output;
            data_table.chart_output = Some((w, h));

            transaction.forward_operations.push(op);
            transaction
                .reverse_operations
                .push(Operation::SetChartCellSize {
                    sheet_pos,
                    w: original.map(|(w, _)| w).unwrap_or(w),
                    h: original.map(|(_, h)| h).unwrap_or(h),
                });

            transaction.add_code_cell(sheet_pos.sheet_id, sheet_pos.into());
            if data_table.is_html() {
                transaction.add_html_cell(sheet_pos.sheet_id, sheet_pos.into());
            } else if data_table.is_image() {
                transaction.add_image_cell(sheet_pos.sheet_id, sheet_pos.into());
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
            if !transaction.is_user_undo_redo() && !transaction.is_server() {
                dbgjs!("Only user / undo / redo / server transaction should have a ComputeCode");
                return;
            }
            let sheet_id = sheet_pos.sheet_id;
            let Some(sheet) = self.try_sheet(sheet_id) else {
                // sheet may have been deleted in a multiplayer operation
                return;
            };
            let pos: Pos = sheet_pos.into();

            // We need to get the corresponding CellValue::Code
            let (language, code) = match sheet.cell_value(pos) {
                Some(CellValue::Code(value)) => (value.language, value.code),

                // handles the case where the ComputeCode operation is running on a non-code cell (maybe changed b/c of a MP operation?)
                _ => return,
            };

            match language {
                CodeCellLanguage::Python => {
                    self.run_python(transaction, sheet_pos, code);
                }
                CodeCellLanguage::Formula => {
                    self.run_formula(transaction, sheet_pos, code);
                }
                CodeCellLanguage::Connection { kind, id } => {
                    self.run_connection(transaction, sheet_pos, code, kind, id);
                }
                CodeCellLanguage::Javascript => {
                    self.run_javascript(transaction, sheet_pos, code);
                }
                CodeCellLanguage::Import => {} // no-op
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        controller::{
            active_transactions::pending_transaction::PendingTransaction,
            operations::operation::Operation, GridController,
        },
        grid::CodeCellLanguage,
        wasm_bindings::js::{clear_js_calls, expect_js_call_count},
        CellValue, Pos, SheetPos,
    };
    use serial_test::serial;

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

        let code_cell = sheet.data_table(Pos { x: 2, y: 1 });
        assert!(code_cell.unwrap().spill_error);
    }

    #[test]
    #[serial]
    fn execute_code() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Javascript,
            "code".to_string(),
            None,
        );
        expect_js_call_count("jsRunJavascript", 1, true);

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Python,
            "code".to_string(),
            None,
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
            sheet.data_table(pos![A1]).unwrap().chart_output,
            Some((4, 5))
        );
    }
}
