use std::collections::HashSet;

use crate::{
    CellValue, Rect,
    a1::{A1Context, A1Selection},
    grid::{
        CodeCellLanguage,
        js_types::{
            JsCellValueDescription, JsChartContext, JsChartSummaryContext, JsCodeCell,
            JsCodeErrorContext, JsCodeTableContext, JsDataTableContext, JsSelectionContext,
            JsTableSummaryContext, JsTableType, JsTablesContext,
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
        include_data_rects_summary: bool,
        a1_context: &A1Context,
    ) -> JsSelectionContext {
        JsSelectionContext {
            sheet_name: self.name.clone(),
            data_rects: if include_data_rects_summary {
                self.get_data_rects_in_selection(&selection, max_rects, max_rows, a1_context)
            } else {
                vec![]
            },
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
    ) -> Vec<JsCellValueDescription> {
        let mut data_rects = Vec::new();
        let selection_rects =
            self.selection_to_rects(selection, false, false, true, a1_context, None);
        let tabular_data_rects =
            self.find_tabular_data_rects_in_selection_rects(selection_rects, max_rects);
        for tabular_data_rect in tabular_data_rects {
            data_rects.push(self.js_cell_value_description(tabular_data_rect, max_rows));
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
        let selection_rects =
            self.selection_to_rects(selection, false, false, true, a1_context, None);
        let mut seen_tables = HashSet::new();
        for rect in selection_rects {
            for (_, pos, table) in self.data_tables.get_in_rect(rect, false) {
                if !seen_tables.insert(pos) {
                    continue;
                }

                if table.has_error() {
                    // if there is an error, then add the code cell to the vec
                    if let Some(code_cell) = self.edit_code_value(pos) {
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
        let selection_rects =
            self.selection_to_rects(selection, false, false, true, a1_context, None);
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
                let mut connection_id = None;
                let table_type = match self.cell_value_ref(pos.to_owned()) {
                    Some(CellValue::Code(code)) => match &code.language {
                        CodeCellLanguage::Python => JsTableType::Python,
                        CodeCellLanguage::Javascript => JsTableType::Javascript,
                        CodeCellLanguage::Formula => JsTableType::Formula,
                        CodeCellLanguage::Connection { id, kind } => {
                            connection_name = Some(kind.to_string());
                            connection_id = Some(id.clone());
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
                    connection_id,
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
        let selection_rects =
            self.selection_to_rects(selection, false, false, true, a1_context, None);
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
    pub fn get_ai_tables_context(&self, sample_rows: usize) -> Option<JsTablesContext> {
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

            let first_row_rect = Rect::new(
                bounds.min.x,
                bounds.min.y + table.y_adjustment(false),
                bounds.max.x,
                bounds.min.y + (bounds.height() as i64).min(sample_rows as i64) - 1,
            );
            let first_rows_visible_values =
                self.js_cell_value_description(first_row_rect, Some(sample_rows));

            let mut starting_last_row = bounds.max.y - sample_rows as i64 + 1;
            if starting_last_row < first_row_rect.max.y {
                starting_last_row = first_row_rect.max.y + 1;
            }
            let last_rows_rect = if starting_last_row > bounds.max.y {
                None
            } else {
                Some(Rect::new(
                    bounds.min.x,
                    starting_last_row,
                    bounds.max.x,
                    bounds.max.y,
                ))
            };

            let last_rows_visible_values =
                last_rows_rect.map(|rect| self.js_cell_value_description(rect, Some(sample_rows)));

            if let CellValue::Code(code_cell_value) = cell_value {
                let Some(code_run) = table.code_run() else {
                    continue;
                };

                tables_context.code_tables.push(JsCodeTableContext {
                    sheet_name: self.name.clone(),
                    code_table_name: table.name().to_string(),
                    all_columns: table.columns_map(true),
                    visible_columns: table.columns_map(false),
                    first_rows_visible_values,
                    last_rows_visible_values,
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
                    first_rows_visible_values,
                    last_rows_visible_values,
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

    /// Returns all code cells with errors or spills in all sheets.
    pub fn get_ai_code_errors(&self, max_errors: usize) -> Vec<JsCodeErrorContext> {
        let mut errors = vec![];

        for (pos, table) in self.data_tables.expensive_iter() {
            if (table.has_spill() || table.has_error_include_single_formula_error())
                && let Some(code_run) = table.code_run()
            {
                if table.has_error_include_single_formula_error() {
                    let error = if let Some(error) = table.get_error() {
                        error.to_string()
                    } else if let Ok(CellValue::Error(error)) = &table.value.as_cell_value() {
                        error.to_string()
                    } else {
                        "Unknown error".to_string()
                    };
                    errors.push(JsCodeErrorContext {
                        sheet_name: self.name.clone(),
                        pos: pos.a1_string(),
                        name: table.name().to_string(),
                        language: code_run.language.clone(),
                        error: Some(error),
                        is_spill: false,
                        expected_bounds: None,
                    });
                } else if table.has_spill() {
                    errors.push(JsCodeErrorContext {
                        sheet_name: self.name.clone(),
                        pos: pos.a1_string(),
                        name: table.name().to_string(),
                        language: code_run.language.clone(),
                        error: None,
                        is_spill: true,
                        expected_bounds: Some(table.output_rect(pos.to_owned(), true).a1_string()),
                    });
                }
                if errors.len() >= max_errors {
                    break;
                }
            }
        }
        errors
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        Array, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetRect, Value,
        a1::A1Selection,
        grid::{
            CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
            js_types::{JsCodeCell, JsReturnInfo},
        },
        test_util::*,
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
            sheet.js_cell_value_description(
                Rect {
                    min: Pos { x: 1, y: 1 },
                    max: Pos { x: 10, y: 100 },
                },
                Some(max_rows),
            ),
            sheet.js_cell_value_description(
                Rect {
                    min: Pos { x: 31, y: 101 },
                    max: Pos { x: 40, y: 200 },
                },
                Some(max_rows),
            ),
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

    #[test]
    fn test_get_ai_code_errors() {
        let mut gc = test_create_gc();
        let sheet1_id = first_sheet_id(&gc);

        // Create a formula with division by zero error on first sheet
        test_create_formula(&mut gc, pos![sheet1_id!A1], "1/0");

        // add a spill target
        test_set_values(&mut gc, sheet1_id, pos![B2], 3, 3);

        // spill a formula
        test_create_formula(&mut gc, pos![sheet1_id!B1], "{1;2;3}");

        let sheet1 = gc.sheet(sheet1_id);
        let errors = sheet1.get_ai_code_errors(10);

        assert_eq!(errors.len(), 2);
        assert_eq!(errors[0].name, "Formula1");
        assert!(errors[0].error.is_some());
        assert!(!errors[0].is_spill);
        assert_eq!(errors[1].name, "Formula2");
        assert!(errors[1].error.is_none());
        assert!(errors[1].is_spill);
        assert_eq!(errors[1].expected_bounds, Some("B1:B3".to_string()));
    }
}
