use crate::{
    a1::A1Selection,
    grid::js_types::{JsCellValuePosAIContext, JsCodeCell},
    CellValue,
};

use super::Sheet;

impl Sheet {
    /// Returns tabular data rects of JsCellValuePos in a1 selection
    pub fn get_ai_context_rects_in_selection(
        &self,
        selection: A1Selection,
        max_rects: Option<usize>,
    ) -> Vec<JsCellValuePosAIContext> {
        let mut ai_context_rects = Vec::new();
        let selection_rects = self.selection_to_rects(&selection, false, false);
        let tabular_data_rects =
            self.find_tabular_data_rects_in_selection_rects(selection_rects, max_rects);
        for tabular_data_rect in tabular_data_rects {
            let js_cell_value_pos_ai_context = JsCellValuePosAIContext {
                sheet_name: self.name.clone(),
                rect_origin: tabular_data_rect.min.a1_string(),
                rect_width: tabular_data_rect.width(),
                rect_height: tabular_data_rect.height(),
                starting_rect_values: self
                    .get_js_cell_value_pos_in_rect(tabular_data_rect, Some(3)),
            };
            ai_context_rects.push(js_cell_value_pos_ai_context);
        }
        ai_context_rects
    }

    /// Returns JsCodeCell for all code cells in selection rects that have errors
    pub fn get_errored_code_cells_in_selection(&self, selection: A1Selection) -> Vec<JsCodeCell> {
        let mut code_cells = Vec::new();
        let selection_rects = self.selection_to_rects(&selection, false, false);
        for selection_rect in selection_rects {
            for x in selection_rect.x_range() {
                if let Some(column) = self.get_column(x) {
                    for y in selection_rect.y_range() {
                        // check if there is a code cell
                        if let Some(CellValue::Code(_)) = column.values.get(&y) {
                            // if there is a code cell, then check if it has an error
                            if self
                                .data_table((x, y).into())
                                .map(|code_run| code_run.has_error())
                                .unwrap_or(false)
                            {
                                // if there is an error, then add the code cell to the vec
                                if let Some(code_cell) = self.edit_code_value((x, y).into()) {
                                    code_cells.push(code_cell);
                                }
                            }
                        }
                    }
                }
            }
        }
        code_cells
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {

    use crate::{
        a1::A1Selection,
        grid::{
            js_types::{JsCellValuePosAIContext, JsCodeCell, JsReturnInfo},
            CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
        },
        Array, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetRect, Value,
    };

    use super::Sheet;

    #[test]
    fn get_ai_context_rects_in_selection() {
        let mut sheet = Sheet::test();
        sheet.set_cell_values(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 10, y: 1000 },
            },
            &Array::from(
                (1..=1000)
                    .map(|row| {
                        (1..=10)
                            .map(|_| {
                                if row == 1 {
                                    "heading1".to_string()
                                } else {
                                    "value1".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        sheet.set_cell_values(
            Rect {
                min: Pos { x: 31, y: 101 },
                max: Pos { x: 40, y: 1100 },
            },
            &Array::from(
                (1..=1000)
                    .map(|row| {
                        (1..=10)
                            .map(|_| {
                                if row == 1 {
                                    "heading2".to_string()
                                } else {
                                    "value3".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 50, 1300, sheet.id));
        let ai_context_rects_in_selection =
            sheet.get_ai_context_rects_in_selection(selection, None);

        let max_rows = 3;

        let expected_ai_context_rects_in_selection = vec![
            JsCellValuePosAIContext {
                sheet_name: sheet.name.clone(),
                rect_origin: Pos { x: 1, y: 1 }.a1_string(),
                rect_width: 10,
                rect_height: 1000,
                starting_rect_values: sheet.get_js_cell_value_pos_in_rect(
                    Rect {
                        min: Pos { x: 1, y: 1 },
                        max: Pos { x: 10, y: 1000 },
                    },
                    Some(max_rows),
                ),
            },
            JsCellValuePosAIContext {
                sheet_name: sheet.name.clone(),
                rect_origin: Pos { x: 31, y: 101 }.a1_string(),
                rect_width: 10,
                rect_height: 1000,
                starting_rect_values: sheet.get_js_cell_value_pos_in_rect(
                    Rect {
                        min: Pos { x: 31, y: 101 },
                        max: Pos { x: 40, y: 1100 },
                    },
                    Some(max_rows),
                ),
            },
        ];

        assert_eq!(
            ai_context_rects_in_selection,
            expected_ai_context_rects_in_selection
        );
    }

    #[test]
    fn test_get_errored_code_cells_in_selection() {
        let mut sheet = Sheet::test();

        let code_run_1 = CodeRun {
            std_out: None,
            std_err: Some("error".to_string()),
            cells_accessed: Default::default(),
            error: Some(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("error".into()),
            }),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        sheet.set_cell_value(
            Pos { x: 1, y: 1 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "abcd".to_string(),
            }),
        );
        sheet.set_data_table(
            Pos { x: 1, y: 1 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run_1),
                "test",
                Default::default(),
                false,
                true,
                false,
                None,
            )),
        );

        let code_run_2 = CodeRun {
            std_out: None,
            std_err: Some("error".to_string()),
            cells_accessed: Default::default(),
            error: Some(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("error".into()),
            }),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        sheet.set_cell_value(
            Pos { x: 9, y: 31 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "abcd".to_string(),
            }),
        );
        sheet.set_data_table(
            Pos { x: 9, y: 31 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run_2),
                "test",
                Default::default(),
                false,
                true,
                false,
                None,
            )),
        );

        let code_run_3 = CodeRun {
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            // result: CodeRunResult::Ok(Value::Array(Array::from(vec![
            //     vec!["1".to_string(), "2".to_string()],
            //     vec!["3".to_string(), "4".to_string()],
            // ]))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        sheet.set_cell_value(
            Pos { x: 19, y: 15 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "[[1, 2], [3, 4]]".to_string(),
            }),
        );
        sheet.set_data_table(
            Pos { x: 19, y: 15 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run_3),
                "test",
                Value::Array(Array::from(vec![
                    vec!["1".to_string(), "2".to_string()],
                    vec!["3".to_string(), "4".to_string()],
                ])),
                true,
                true,
                false,
                None,
            )),
        );

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1000, 1000, sheet.id));
        let js_errored_code_cells = sheet.get_errored_code_cells_in_selection(selection);

        assert_eq!(js_errored_code_cells.len(), 2);

        let expected_js_errored_code_cells = vec![
            JsCodeCell {
                x: 1,
                y: 1,
                code_string: "abcd".to_string(),
                language: CodeCellLanguage::Python,
                std_err: Some("error".to_string()),
                std_out: None,
                evaluation_result: Some(
                    "{\"span\":null,\"msg\":{\"CodeRunError\":\"error\"}}".to_string(),
                ),
                spill_error: None,
                return_info: Some(JsReturnInfo {
                    line_number: None,
                    output_type: None,
                }),
                cells_accessed: Some(Default::default()),
            },
            JsCodeCell {
                x: 9,
                y: 31,
                code_string: "abcd".to_string(),
                language: CodeCellLanguage::Python,
                std_err: Some("error".to_string()),
                std_out: None,
                evaluation_result: Some(
                    "{\"span\":null,\"msg\":{\"CodeRunError\":\"error\"}}".to_string(),
                ),
                spill_error: None,
                return_info: Some(JsReturnInfo {
                    line_number: None,
                    output_type: None,
                }),
                cells_accessed: Some(Default::default()),
            },
        ];

        assert_eq!(js_errored_code_cells, expected_js_errored_code_cells);
    }
}
