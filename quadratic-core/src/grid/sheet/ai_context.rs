use std::collections::HashSet;

use crate::{
    CellValue, Rect,
    a1::{A1Context, A1Selection},
    grid::{
        CodeCellLanguage,
        js_types::{
            JsCellValuePosContext, JsChartContext, JsChartSummaryContext, JsCodeCell,
            JsCodeTableContext, JsDataTableContext, JsSelectionContext, JsTableSummaryContext,
            JsTableType, JsTablesContext,
        },
    },
};

use super::Sheet;

impl Sheet {
    #[allow(clippy::too_many_arguments)]
    pub fn get_ai_selection_context(
        &self,
        selection: A1Selection,
        max_rects: Option<usize>,
        max_rows: Option<usize>,
        include_errored_code_cells: bool,
        include_tables_summary: bool,
        include_charts_summary: bool,
        a1_context: &A1Context,
    ) -> JsSelectionContext {
        JsSelectionContext {
            sheet_name: self.name.clone(),
            data_rects: self
                .get_data_rects_in_selection(&selection, max_rects, max_rows, a1_context),
            errored_code_cells: include_errored_code_cells
                .then(|| self.get_errored_code_cells_in_selection(&selection, a1_context)),
            tables_summary: include_tables_summary
                .then(|| self.get_tables_summary_in_selection(&selection, a1_context)),
            charts_summary: include_charts_summary
                .then(|| self.get_charts_summary_in_selection(&selection, a1_context)),
        }
    }

    /// Returns tabular data rects of JsCellValuePos in a1 selection
    fn get_data_rects_in_selection(
        &self,
        selection: &A1Selection,
        max_rects: Option<usize>,
        max_rows: Option<usize>,
        a1_context: &A1Context,
    ) -> Vec<JsCellValuePosContext> {
        let mut data_rects = Vec::new();
        let selection_rects = self.selection_to_rects(selection, false, false, true, a1_context);
        let tabular_data_rects =
            self.find_tabular_data_rects_in_selection_rects(selection_rects, max_rects);
        for tabular_data_rect in tabular_data_rects {
            let cell_value_pos = JsCellValuePosContext {
                sheet_name: self.name.clone(),
                rect_origin: tabular_data_rect.min.a1_string(),
                rect_width: tabular_data_rect.width(),
                rect_height: tabular_data_rect.height(),
                starting_rect_values: self.js_cell_value_pos_in_rect(tabular_data_rect, max_rows),
            };
            data_rects.push(cell_value_pos);
        }
        data_rects
    }

    /// Returns JsCodeCell for all code cells in selection rects that have errors
    fn get_errored_code_cells_in_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Vec<JsCodeCell> {
        let mut errored_code_cells = Vec::new();
        let selection_rects = self.selection_to_rects(selection, false, false, true, a1_context);
        let mut seen_tables = HashSet::new();
        for rect in selection_rects {
            for (_, pos, table) in self.data_tables.get_in_rect(rect, false) {
                if !seen_tables.insert(pos) {
                    continue;
                }

                if table.has_error() {
                    // if there is an error, then add the code cell to the vec
                    if let Some(code_cell) = self.edit_code_value(pos, a1_context) {
                        errored_code_cells.push(code_cell);
                    }
                }
            }
        }
        errored_code_cells
    }

    fn get_tables_summary_in_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Vec<JsTableSummaryContext> {
        let mut tables_summary = Vec::new();
        let selection_rects = self.selection_to_rects(selection, false, false, true, a1_context);
        let mut seen_tables = HashSet::new();
        for rect in selection_rects {
            for (_, pos, table) in self.data_tables.get_in_rect(rect, false) {
                if !seen_tables.insert(pos) {
                    continue;
                }

                if table.is_html_or_image() || table.is_formula_table() || table.is_single_value() {
                    continue;
                }

                let mut connection_name = None;
                let table_type = match self.cell_value_ref(pos.to_owned()) {
                    Some(CellValue::Code(code)) => match &code.language {
                        CodeCellLanguage::Python => JsTableType::Python,
                        CodeCellLanguage::Javascript => JsTableType::Javascript,
                        CodeCellLanguage::Formula => JsTableType::Formula,
                        CodeCellLanguage::Connection { id, kind } => {
                            connection_name = Some(kind.to_string());
                            JsTableType::Connection
                        }
                        CodeCellLanguage::Import => JsTableType::DataTable,
                    },
                    Some(CellValue::Import(_)) => JsTableType::DataTable,
                    _ => continue,
                };

                tables_summary.push(JsTableSummaryContext {
                    sheet_name: self.name.clone(),
                    table_name: table.name().to_string(),
                    table_type,
                    bounds: table.output_rect(pos, false).a1_string(),
                    connection_name,
                });
            }
        }
        tables_summary
    }

    fn get_charts_summary_in_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Vec<JsChartSummaryContext> {
        let mut charts_summary = Vec::new();
        let selection_rects = self.selection_to_rects(selection, false, false, true, a1_context);
        let mut seen_tables = HashSet::new();
        for rect in selection_rects {
            for (_, pos, table) in self.data_tables.get_in_rect(rect, false) {
                if !seen_tables.insert(pos) {
                    continue;
                }

                if !table.is_html_or_image() || table.has_spill() {
                    continue;
                }

                charts_summary.push(JsChartSummaryContext {
                    sheet_name: self.name.clone(),
                    chart_name: table.name().to_string(),
                    bounds: table.output_rect(pos, false).a1_string(),
                });
            }
        }
        charts_summary
    }

    /// Returns JsTablesContext for all tables (data, code, charts) in the sheet
    pub fn get_ai_tables_context(&self) -> Option<JsTablesContext> {
        let mut tables_context = JsTablesContext {
            sheet_name: self.name.clone(),
            data_tables: Vec::new(),
            code_tables: Vec::new(),
            charts: Vec::new(),
        };

        for (pos, table) in self.data_tables.expensive_iter() {
            if table.is_single_value() {
                continue;
            }

            let Some(cell_value) = self.cell_value_ref(pos.to_owned()) else {
                continue;
            };

            let intended_bounds = table.output_rect(pos.to_owned(), true);
            let bounds = table.output_rect(pos.to_owned(), false);

            if table.is_html_or_image() {
                if let CellValue::Code(code_cell_value) = cell_value {
                    tables_context.charts.push(JsChartContext {
                        sheet_name: self.name.clone(),
                        chart_name: table.name().to_string(),
                        bounds: bounds.a1_string(),
                        intended_bounds: intended_bounds.a1_string(),
                        language: code_cell_value.language.to_owned(),
                        code_string: code_cell_value.code.to_owned(),
                        spill: table.has_spill(),
                    });
                }
                continue;
            }

            let first_row_rect = Rect::from_numbers(
                bounds.min.x,
                bounds.min.y + table.y_adjustment(false),
                bounds.width() as i64,
                1,
            );
            let first_row_visible_values = self
                .js_cell_value_pos_in_rect(first_row_rect, Some(1))
                .into_iter()
                .flatten()
                .collect::<Vec<_>>();

            let last_row_rect =
                Rect::from_numbers(bounds.min.x, bounds.max.y, bounds.width() as i64, 1);
            let last_row_visible_values = self
                .js_cell_value_pos_in_rect(last_row_rect, Some(1))
                .into_iter()
                .flatten()
                .collect::<Vec<_>>();

            if let CellValue::Code(code_cell_value) = cell_value {
                let Some(code_run) = table.code_run() else {
                    continue;
                };

                tables_context.code_tables.push(JsCodeTableContext {
                    sheet_name: self.name.clone(),
                    code_table_name: table.name().to_string(),
                    all_columns: table.columns_map(true),
                    visible_columns: table.columns_map(false),
                    first_row_visible_values,
                    last_row_visible_values,
                    bounds: bounds.a1_string(),
                    intended_bounds: intended_bounds.a1_string(),
                    show_name: table.get_show_name(),
                    show_columns: table.get_show_columns(),
                    language: code_cell_value.language.to_owned(),
                    code_string: code_cell_value.code.to_owned(),
                    std_err: code_run.std_err.to_owned(),
                    error: code_run.error.is_some(),
                    spill: table.has_spill(),
                });
            } else if cell_value.is_import() {
                tables_context.data_tables.push(JsDataTableContext {
                    sheet_name: self.name.clone(),
                    data_table_name: table.name().to_string(),
                    all_columns: table.columns_map(true),
                    visible_columns: table.columns_map(false),
                    first_row_visible_values,
                    last_row_visible_values,
                    bounds: bounds.a1_string(),
                    intended_bounds: intended_bounds.a1_string(),
                    show_name: table.get_show_name(),
                    show_columns: table.get_show_columns(),
                    spill: table.has_spill(),
                });
            }
        }

        if tables_context.data_tables.is_empty()
            && tables_context.code_tables.is_empty()
            && tables_context.charts.is_empty()
        {
            None
        } else {
            Some(tables_context)
        }
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        Array, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetRect, Value,
        a1::A1Selection,
        grid::{
            CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
            js_types::{JsCellValuePosContext, JsCodeCell, JsReturnInfo},
        },
    };

    use super::Sheet;

    #[test]
    fn test_get_data_rects_in_selection() {
        let mut sheet = Sheet::test();
        sheet.set_cell_values(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 10, y: 100 },
            },
            Array::from(
                (1..=100)
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
                max: Pos { x: 40, y: 200 },
            },
            Array::from(
                (1..=100)
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

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 50, 300, sheet.id));
        let a1_context = sheet.expensive_make_a1_context();
        let data_rects_in_selection =
            sheet.get_data_rects_in_selection(&selection, None, Some(3), &a1_context);

        let max_rows = 3;

        let expected_data_rects_in_selection = vec![
            JsCellValuePosContext {
                sheet_name: sheet.name.clone(),
                rect_origin: Pos { x: 1, y: 1 }.a1_string(),
                rect_width: 10,
                rect_height: 100,
                starting_rect_values: sheet.js_cell_value_pos_in_rect(
                    Rect {
                        min: Pos { x: 1, y: 1 },
                        max: Pos { x: 10, y: 100 },
                    },
                    Some(max_rows),
                ),
            },
            JsCellValuePosContext {
                sheet_name: sheet.name.clone(),
                rect_origin: Pos { x: 31, y: 101 }.a1_string(),
                rect_width: 10,
                rect_height: 100,
                starting_rect_values: sheet.js_cell_value_pos_in_rect(
                    Rect {
                        min: Pos { x: 31, y: 101 },
                        max: Pos { x: 40, y: 200 },
                    },
                    Some(max_rows),
                ),
            },
        ];

        assert_eq!(data_rects_in_selection, expected_data_rects_in_selection);
    }

    #[test]
    fn test_get_errored_code_cells_in_selection() {
        let mut sheet = Sheet::test();

        let code_run_1 = CodeRun {
            language: CodeCellLanguage::Python,
            code: "abcd".to_string(),
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
                true,
                Some(false),
                Some(false),
                None,
            )),
        );

        let code_run_2 = CodeRun {
            language: CodeCellLanguage::Python,
            code: "abcd".to_string(),
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
                true,
                Some(false),
                Some(false),
                None,
            )),
        );

        let code_run_3 = CodeRun {
            language: CodeCellLanguage::Python,
            code: "[[1, 2], [3, 4]]".to_string(),
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
                Some(false),
                Some(false),
                None,
            )),
        );

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1000, 1000, sheet.id));
        let a1_context = sheet.expensive_make_a1_context();
        let js_errored_code_cells =
            sheet.get_errored_code_cells_in_selection(&selection, &a1_context);

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
                last_modified: js_errored_code_cells[0].last_modified,
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
                last_modified: js_errored_code_cells[1].last_modified,
            },
        ];

        assert_eq!(js_errored_code_cells, expected_js_errored_code_cells);
    }
}
