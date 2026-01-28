use std::collections::HashSet;

use crate::{
    CellValue,
    a1::{A1Context, A1Selection},
    grid::{
        CodeCellLanguage, DataTableKind,
        js_types::{
            JsCellValueSummary, JsChartContext, JsCodeCell, JsCodeErrorContext, JsCodeTableContext,
            JsDataTableContext, JsSummaryContext,
        },
    },
};

use super::Sheet;

#[derive(Debug)]
pub struct TablesContext {
    pub data_tables: Vec<JsDataTableContext>,
    pub code_tables: Vec<JsCodeTableContext>,
    pub connections: Vec<JsCodeTableContext>,
    pub charts: Vec<JsChartContext>,
}

impl Sheet {
    pub fn get_ai_selection_context(
        &self,
        selection: A1Selection,
        max_rows: Option<usize>,
        a1_context: &A1Context,
    ) -> JsSummaryContext {
        let (default_column_width, default_row_height) = self.offsets.defaults();
        let mut summary = JsSummaryContext {
            sheet_name: self.name.clone(),
            default_column_width,
            default_row_height,
            data_rects: self.get_data_rects_in_selection(&selection, max_rows, a1_context),
            errored_code_cells: self.get_errored_code_cells_in_selection(&selection, a1_context),
            data_tables: None,
            code_tables: None,
            connections: None,
            charts: None,
        };
        if let Some(tables) = self.get_tables_context(&selection, max_rows, a1_context) {
            summary.data_tables = Some(tables.data_tables);
            summary.code_tables = Some(tables.code_tables);
            summary.connections = Some(tables.connections);
            summary.charts = Some(tables.charts);
        }
        summary
    }

    /// Returns tabular data rects of JsCellValuePos in a1 selection
    fn get_data_rects_in_selection(
        &self,
        selection: &A1Selection,
        max_rows: Option<usize>,
        a1_context: &A1Context,
    ) -> Vec<JsCellValueSummary> {
        let mut data_rects = Vec::new();
        let selection_rects = self.selection_to_rects(selection, false, false, true, a1_context);
        let tabular_data_rects = self.find_tabular_data_rects_in_selection_rects(selection_rects);
        for tabular_data_rect in tabular_data_rects {
            let values = self.js_cell_value_description(tabular_data_rect, max_rows);
            data_rects.push(values);
        }
        data_rects
    }

    /// Returns JsCodeCell for all code cells in selection rects that have errors
    fn get_errored_code_cells_in_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<Vec<JsCodeCell>> {
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
        if errored_code_cells.is_empty() {
            None
        } else {
            Some(errored_code_cells)
        }
    }

    /// Returns TablesContext for all tables (data, code, charts) in the sheet.
    /// If sample_rows is None, then no sample rows are not included.
    fn get_tables_context(
        &self,
        selection: &A1Selection,
        sample_rows: Option<usize>,
        a1_context: &A1Context,
    ) -> Option<TablesContext> {
        let mut tables_context = TablesContext {
            data_tables: Vec::new(),
            code_tables: Vec::new(),
            connections: Vec::new(),
            charts: Vec::new(),
        };

        for (pos, table) in self.data_tables.expensive_iter() {
            if table.is_single_value() {
                continue;
            }

            let intended_bounds = table.output_rect(pos.to_owned(), true);
            let bounds = table.output_rect(pos.to_owned(), false);

            if !selection.contains_rect(bounds, a1_context) {
                continue;
            }

            if table.is_html_or_image() {
                if let Some(code_run) = table.code_run() {
                    tables_context.charts.push(JsChartContext {
                        sheet_name: self.name.clone(),
                        chart_name: table.name().to_string(),
                        bounds: bounds.a1_string(),
                        intended_bounds: intended_bounds.a1_string(),
                        language: code_run.language.to_owned(),
                        code_string: code_run.code.to_owned(),
                        spill: table.has_spill(),
                    });
                }
                continue;
            }

            let values = sample_rows
                .map(|sample_rows| self.js_cell_value_description(bounds, Some(sample_rows)));

            match &table.kind {
                DataTableKind::CodeRun(code_run) => {
                    let table_context = JsCodeTableContext {
                        sheet_name: self.name.clone(),
                        code_table_name: table.name().to_string(),
                        all_columns: table.columns_map(true),
                        visible_columns: table.columns_map(false),
                        values,
                        bounds: bounds.a1_string(),
                        intended_bounds: intended_bounds.a1_string(),
                        show_name: table.get_show_name(),
                        show_columns: table.get_show_columns(),
                        language: code_run.language.to_owned(),
                        code_string: code_run.code.to_owned(),
                        std_err: code_run.std_err.to_owned(),
                        error: code_run.error.is_some(),
                        spill: table.has_spill(),
                    };
                    if let CodeCellLanguage::Connection { .. } = &code_run.language {
                        tables_context.connections.push(table_context);
                    } else {
                        tables_context.code_tables.push(table_context);
                    }
                }
                DataTableKind::Import(_) => {
                    tables_context.data_tables.push(JsDataTableContext {
                        sheet_name: self.name.clone(),
                        data_table_name: table.name().to_string(),
                        all_columns: table.columns_map(true),
                        visible_columns: table.columns_map(false),
                        values,
                        bounds: bounds.a1_string(),
                        intended_bounds: intended_bounds.a1_string(),
                        show_name: table.get_show_name(),
                        show_columns: table.get_show_columns(),
                        spill: table.has_spill(),
                    });
                }
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
        Array, Pos, Rect, RunError, RunErrorMsg, SheetRect, Value,
        a1::A1Selection,
        grid::{
            CodeCellLanguage, CodeRun, DataTable, DataTableKind,
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
        let max_rows = 3;
        let data_rects_in_selection =
            sheet.get_data_rects_in_selection(&selection, Some(max_rows), &a1_context);

        assert_eq!(data_rects_in_selection.len(), 2);
        assert_eq!(data_rects_in_selection[0].total_range, "A1:J100");
        assert_eq!(
            data_rects_in_selection[0].start_range,
            Some("A1:J3".to_string())
        );
        assert_eq!(
            data_rects_in_selection[0]
                .start_values
                .as_ref()
                .unwrap()
                .iter()
                .flatten()
                .count(),
            max_rows * 10
        );
        assert_eq!(
            data_rects_in_selection[0]
                .end_values
                .as_ref()
                .unwrap()
                .iter()
                .flatten()
                .count(),
            max_rows * 10
        );
        assert_eq!(
            data_rects_in_selection[0].end_range,
            Some("A98:J100".to_string())
        );

        assert_eq!(data_rects_in_selection[1].total_range, "AE101:AN200");
        assert_eq!(
            data_rects_in_selection[1].start_range,
            Some("AE101:AN103".to_string())
        );
        assert_eq!(
            data_rects_in_selection[1]
                .start_values
                .as_ref()
                .unwrap()
                .iter()
                .flatten()
                .count(),
            max_rows * 10
        );
        assert_eq!(
            data_rects_in_selection[1]
                .end_values
                .as_ref()
                .unwrap()
                .iter()
                .flatten()
                .count(),
            max_rows * 10
        );
        assert_eq!(
            data_rects_in_selection[1].end_range,
            Some("AE198:AN200".to_string())
        );
    }

    #[test]
    fn test_get_errored_code_cells_in_selection() {
        let mut sheet = Sheet::test();

        let code_run_1 = CodeRun {
            language: CodeCellLanguage::Python,
            code: "abcd".to_string(),
            formula_ast: None,
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
            formula_ast: None,
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
            formula_ast: None,
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

        assert_eq!(js_errored_code_cells.as_ref().unwrap().len(), 2);

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
                last_modified: js_errored_code_cells.as_ref().unwrap()[0].last_modified,
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
                last_modified: js_errored_code_cells.as_ref().unwrap()[1].last_modified,
            },
        ];

        assert_eq!(
            js_errored_code_cells.unwrap(),
            expected_js_errored_code_cells
        );
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
