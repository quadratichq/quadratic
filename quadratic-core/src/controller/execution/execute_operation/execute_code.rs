use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::CodeCellLanguage,
    CellValue, Pos, Rect, SheetPos, SheetRect,
};

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

    // delete any code runs within the sheet_rect.
    pub(super) fn check_deleted_code_runs(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
    ) {
        let sheet_id = sheet_rect.sheet_id;
        let Some(sheet) = self.grid.try_sheet(sheet_id) else {
            // sheet may have been deleted
            return;
        };
        let rect: Rect = (*sheet_rect).into();
        let code_runs_to_delete: Vec<Pos> = sheet
            .code_runs
            .iter()
            .filter_map(|(pos, _)| {
                // only delete code runs that are within the sheet_rect
                if rect.contains(*pos) {
                    // only delete when there's not another code cell in the same position (this maintains the original output until a run completes)
                    if let Some(value) = sheet.cell_value(*pos) {
                        if matches!(value, CellValue::Code(_)) {
                            None
                        } else {
                            Some(pos.clone())
                        }
                    } else {
                        Some(pos.clone())
                    }
                } else {
                    None
                }
            })
            .collect();
        code_runs_to_delete.iter().for_each(|pos| {
            self.finalize_code_run(transaction, pos.to_sheet_pos(sheet_id), None);
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
        } = op
        {
            self.finalize_code_run(transaction, sheet_pos, code_run);
        }
    }

    pub(super) fn execute_compute_code(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ComputeCode { sheet_pos } = op {
            if !transaction.is_user() {
                unreachable!("Only a user transaction should have a ComputeCode");
            }
            let sheet_id = sheet_pos.sheet_id;
            let Some(sheet) = self.try_sheet(sheet_id) else {
                // sheet may have been deleted in a multiplayer operation
                return;
            };
            let pos: Pos = sheet_pos.into();

            // We need to get the corresponding CellValue::Code, which should always exist.
            let (language, code) = match sheet.cell_value(pos) {
                Some(code_cell) => match code_cell {
                    CellValue::Code(value) => (value.language, value.code),
                    _ => unreachable!("Expected CellValue::Code in execute_set_code_cell"),
                },
                None => unreachable!("Expected CellValue::Code in execute_set_code_cell"),
            };

            match language {
                CodeCellLanguage::Python => {
                    self.run_python(transaction, sheet_pos, code);
                }
                CodeCellLanguage::Formula => {
                    self.run_formula(transaction, sheet_pos, code);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use chrono::Utc;

    use crate::{
        controller::GridController,
        grid::{js_types::JsRenderCell, CellAlign, CodeCellLanguage, CodeRun, CodeRunResult},
        Array, CellValue, Pos, Rect, SheetPos, Value,
    };

    #[test]
    fn test_spilled_output_over_normal_cell() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text("one".into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Text("two".into()));
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A0:A1".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("one".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("two".into()))
        );
        assert_eq!(sheet.display_value(Pos { x: 0, y: 2 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Text("one".into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("two".into()))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "cause spill".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("cause spill".into()))
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Blank)
        );

        let code_cell = sheet.code_run(Pos { x: 1, y: 0 });
        assert!(code_cell.unwrap().spill_error);
    }

    fn output_spill_error(x: i64, y: i64) -> Vec<JsRenderCell> {
        vec![JsRenderCell {
            x,
            y,
            language: Some(CodeCellLanguage::Formula),
            value: " SPILL".into(),
            align: None,
            wrap: None,
            bold: None,
            italic: Some(true),
            text_color: Some("red".into()),
        }]
    }

    fn output_number(
        x: i64,
        y: i64,
        n: &str,
        language: Option<CodeCellLanguage>,
    ) -> Vec<JsRenderCell> {
        vec![JsRenderCell {
            x,
            y,
            language,
            value: n.into(),
            align: Some(CellAlign::Right),
            wrap: None,
            bold: None,
            italic: None,
            text_color: None,
        }]
    }

    #[test]
    fn test_check_spills() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "2".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "3".into(),
            None,
        );

        // value to cause the spill
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "hello".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B0:B3".into(),
            None,
        );
        let sheet = gc.sheet(sheet_id);

        let code_run = sheet.code_run(Pos { x: 0, y: 0 });
        assert!(code_run.is_some());
        assert!(code_run.unwrap().spill_error);

        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));

        // should be a spill caused by 0,1
        assert_eq!(render_cells, output_spill_error(0, 0));

        // remove 'hello' that caused spill
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "".into(),
            None,
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        let code_run = sheet.code_run(Pos { x: 0, y: 0 });
        assert!(code_run.is_some());
        assert!(!code_run.unwrap().spill_error);

        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));

        // should be B0: "1" since spill was removed
        assert_eq!(
            render_cells,
            output_number(0, 0, "1", Some(CodeCellLanguage::Formula)),
        );
    }

    #[test]
    fn test_check_spills_over_code() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "2".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "3".into(),
            None,
        );

        // value to cause the spill
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B0:B3".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));
        assert_eq!(
            render_cells,
            output_number(0, 0, "1", Some(CodeCellLanguage::Formula))
        );
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 1 }));
        assert_eq!(render_cells, output_number(0, 1, "2", None),);

        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1 + 2".into(),
            None,
        );

        // should be spilled because of the code_cell
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 0, y: 0 }));
        assert_eq!(render_cells, output_spill_error(0, 0),);
    }

    #[test]
    fn test_check_spills_over_code_array() {
        let mut gc = GridController::default();
        let sheet_id = gc.grid.sheet_ids()[0];

        // values to copy
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            "2".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 2,
                sheet_id,
            },
            "3".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "2".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            "3".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 0,
                sheet_id,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "2".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "3".into(),
            None,
        );

        // copies values to copy to 10,10
        gc.set_code_cell(
            SheetPos {
                x: 10,
                y: 10,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A0:C2".into(),
            None,
        );

        // output that is spilled
        gc.set_code_cell(
            SheetPos {
                x: 11,
                y: 9,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A0:A2".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 11, y: 9 }));
        assert_eq!(render_cells, output_spill_error(11, 9));

        // delete the code_cell that caused the spill
        gc.set_cell_value(
            SheetPos {
                x: 10,
                y: 10,
                sheet_id,
            },
            "".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_render_cells(Rect::single_pos(Pos { x: 11, y: 9 }));
        assert_eq!(
            render_cells,
            output_number(11, 9, "1", Some(CodeCellLanguage::Formula))
        );
    }

    #[test]
    fn test_check_deleted_code_runs() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            result: CodeRunResult::Ok(Value::Array(Array::from(vec![vec!["1"]]))),
            spill_error: false,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            formatted_code_string: None,
        };
        let pos = Pos { x: 0, y: 0 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_code_run(pos, Some(code_run.clone()));
    }
}
