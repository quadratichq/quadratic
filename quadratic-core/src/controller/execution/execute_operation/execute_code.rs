use crate::{
    MultiPos, MultiSheetPos, SheetRect,
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
        output: &SheetRect,
        skip_compute: Option<MultiSheetPos>,
    ) {
        if !transaction.is_user_ai() {
            return;
        }

        self.get_dependent_code_cells(output)
            .iter()
            .for_each(|sheet_positions| {
                sheet_positions.iter().for_each(|code_cell_multi_pos| {
                    if !skip_compute
                        .is_some_and(|skip_compute| skip_compute == *code_cell_multi_pos)
                    {
                        // only add a compute operation if there isn't already one pending
                        if !transaction.operations.iter().any(|op| match op {
                            Operation::ComputeCodeMultiPos { multi_sheet_pos } => {
                                code_cell_multi_pos == multi_sheet_pos
                            }
                            _ => false,
                        }) {
                            transaction
                                .operations
                                .push_back(Operation::ComputeCodeMultiPos {
                                    multi_sheet_pos: *code_cell_multi_pos,
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
            let data_table_multi_pos = data_table_pos.into();
            let original = sheet
                .data_table_result_at(&data_table_multi_pos)?
                .chart_pixel_output;
            let (data_table, dirty_rects) =
                sheet.modify_data_table_at(&data_table_multi_pos, |dt| {
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
            let data_table_multi_pos = data_table_pos.into();
            let original = sheet
                .data_table_result_at(&data_table_multi_pos)?
                .chart_output;
            let (data_table, dirty_rects) =
                sheet.modify_data_table_at(&data_table_multi_pos, |dt| {
                    dt.chart_output = Some((w, h));
                    Ok(())
                })?;

            transaction.add_update_selection(A1Selection::table(sheet_pos, data_table.name()));

            transaction.add_from_code_run(
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

    /// Deprecated and replaced with execute_compute_code_multi_pos
    pub(super) fn execute_compute_code(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ComputeCode { sheet_pos } = op {
            self.execute_compute_code_multi_pos(
                transaction,
                Operation::ComputeCodeMultiPos {
                    multi_sheet_pos: sheet_pos.into(),
                },
            );
        }
    }

    /// Executes a code cell at a multi-pos.
    pub(crate) fn execute_compute_code_multi_pos(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ComputeCodeMultiPos { multi_sheet_pos } = op {
            if !transaction.is_user_ai_undo_redo() && !transaction.is_server() {
                dbgjs!(
                    "Only user / ai / undo / redo / server transaction should have a ComputeCode"
                );
                return;
            }

            let Some(sheet) = self.try_sheet(multi_sheet_pos.sheet_id) else {
                return;
            };

            let Some(code_cell) = sheet.code_value(multi_sheet_pos.multi_pos) else {
                return;
            };

            let Some(sheet_pos) = multi_sheet_pos.to_sheet_pos(sheet) else {
                return;
            };

            match &code_cell.language {
                CodeCellLanguage::Python => {
                    self.run_python(
                        transaction,
                        multi_sheet_pos,
                        code_cell.code.clone(),
                        sheet_pos.into(),
                    );
                }
                CodeCellLanguage::Formula => {
                    self.run_formula(
                        transaction,
                        multi_sheet_pos,
                        code_cell.code.clone(),
                        sheet_pos,
                    );
                }
                CodeCellLanguage::Connection { kind, id } => {
                    // we currently only support connections on sheet positions
                    if matches!(multi_sheet_pos.multi_pos, MultiPos::Pos(_)) {
                        self.run_connection(
                            transaction,
                            sheet_pos,
                            code_cell.code.clone(),
                            *kind,
                            id.clone(),
                        );
                    }
                }
                CodeCellLanguage::Javascript => {
                    self.run_javascript(
                        transaction,
                        multi_sheet_pos,
                        code_cell.code.clone(),
                        sheet_pos,
                    );
                }
                CodeCellLanguage::Import => (), // no-op
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, Pos, SheetPos,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
            operations::operation::Operation,
        },
        grid::CodeCellLanguage,
        test_util::*,
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
            SheetPos::new(sheet_id, 2, 1),
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

        let code_cell = sheet.data_table_at(&Pos { x: 2, y: 1 }.into());
        assert!(code_cell.unwrap().has_spill());
    }

    #[test]
    fn execute_code() {
        clear_js_calls();

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Javascript,
            "code".to_string(),
            None,
            None,
            false,
        );
        expect_js_call_count("jsRunJavascript", 1, true);

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
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
            sheet.data_table_at(&pos![A1].into()).unwrap().chart_output,
            Some((4, 5))
        );
    }
}
