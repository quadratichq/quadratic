//! Code and html/image output for client rendering.

use crate::{
    CellValue, Pos, Value,
    grid::{
        CodeCellLanguage, DataTable, DataTableKind, Sheet,
        js_types::{JsHtmlOutput, JsRenderCodeCell, JsRenderCodeCellState},
    },
};

impl Sheet {
    pub fn get_single_html_output(&self, pos: Pos) -> Option<JsHtmlOutput> {
        let dt = self.data_table_at(&pos)?;
        if !dt.is_html() {
            return None;
        }
        let output = dt.cell_value_at(0, 0)?;

        Some(JsHtmlOutput {
            sheet_id: self.id.to_string(),
            x: pos.x as i32,
            y: pos.y as i32,
            w: dt.chart_output.map(|(w, _)| w as i32).unwrap_or_default(),
            h: dt
                .chart_output
                .map(|(_, h)| h as i32 + 1)
                .unwrap_or_default(),
            html: Some(output.to_display()),
            name: dt.name().to_string(),
            show_name: dt.get_show_name(),
            chart_image: dt.chart_image.clone(),
        })
    }

    pub fn get_html_output(&self) -> Vec<JsHtmlOutput> {
        self.data_tables
            .expensive_iter()
            .filter_map(|(pos, dt)| {
                let output = dt.cell_value_at(0, 0)?;
                if !matches!(output, CellValue::Html(_)) {
                    return None;
                }
                Some(JsHtmlOutput {
                    sheet_id: self.id.to_string(),
                    x: pos.x as i32,
                    y: pos.y as i32,
                    w: dt.chart_output.map(|(w, _)| w as i32).unwrap_or_default(),
                    h: dt
                        .chart_output
                        .map(|(_, h)| h as i32 + 1)
                        .unwrap_or_default(),
                    html: Some(output.to_display()),
                    name: dt.name().to_string(),
                    show_name: dt.get_show_name(),
                    chart_image: dt.chart_image.clone(),
                })
            })
            .collect()
    }

    // Returns data for rendering a code cell.
    fn render_code_cell(&self, pos: Pos, data_table: &DataTable) -> Option<JsRenderCodeCell> {
        let output_size = data_table.output_size();
        let (state, w, h, spill_error) = if data_table.has_spill() {
            let reasons = self.find_spill_error_reasons(&data_table.output_rect(pos, true), pos);
            (
                JsRenderCodeCellState::SpillError,
                output_size.w.get(),
                output_size.h.get(),
                Some(reasons),
            )
        } else if data_table.has_error()
            || matches!(data_table.value, Value::Single(CellValue::Error(_)))
        {
            (JsRenderCodeCellState::RunError, 1, 1, None)
        } else {
            let state = if data_table.is_image() {
                JsRenderCodeCellState::Image
            } else if data_table.is_html() {
                JsRenderCodeCellState::HTML
            } else {
                JsRenderCodeCellState::Success
            };
            (state, output_size.w.get(), output_size.h.get(), None)
        };
        let alternating_colors = !data_table.has_spill()
            && !data_table.has_error()
            && !data_table.is_image()
            && !data_table.is_html()
            && data_table.alternating_colors;

        let language = match &data_table.kind {
            DataTableKind::CodeRun(code) => code.language.to_owned(),
            DataTableKind::Import(_) => CodeCellLanguage::Import,
        };
        Some(JsRenderCodeCell {
            x: pos.x as i32,
            y: pos.y as i32,
            w,
            h,
            language,
            state,
            spill_error,
            name: data_table.name().to_string(),
            columns: data_table.send_columns(),
            first_row_header: data_table.header_is_first_row,
            show_name: data_table.get_show_name(),
            show_columns: data_table.get_show_columns(),
            sort: data_table.sort.clone(),
            sort_dirty: data_table.sort_dirty,
            alternating_colors,
            is_code: data_table.is_code(),
            is_html: data_table.is_html(),
            is_html_image: data_table.is_html() || data_table.is_image(),
            last_modified: data_table.last_modified.timestamp_millis(),
        })
    }

    // Returns a single code cell for rendering.
    pub fn get_render_code_cell(&self, pos: Pos) -> Option<JsRenderCodeCell> {
        // First check for CellValue::Code
        if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
            let state = if code_cell.code_run.error.is_some()
                || matches!(*code_cell.output, CellValue::Error(_))
            {
                JsRenderCodeCellState::RunError
            } else {
                JsRenderCodeCellState::Success
            };
            return Some(JsRenderCodeCell {
                x: pos.x as i32,
                y: pos.y as i32,
                w: 1,
                h: 1,
                language: code_cell.code_run.language.clone(),
                state,
                spill_error: None,
                name: String::new(),
                columns: Vec::new(),
                first_row_header: false,
                show_name: false,
                show_columns: false,
                sort: None,
                sort_dirty: false,
                alternating_colors: false,
                is_code: true,
                is_html: false,
                is_html_image: false,
                last_modified: code_cell.last_modified.timestamp_millis(),
            });
        }
        // Otherwise check data_tables
        let data_table = self.data_table_at(&pos)?;
        self.render_code_cell(pos, data_table)
    }

    /// Returns all code cells for rendering.
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.data_tables
            .expensive_iter()
            .filter_map(|(pos, data_table)| self.render_code_cell(*pos, data_table))
            .collect()
    }

    /// Sends all sheet code cells for rendering to client
    pub fn send_all_render_code_cells(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let code = self.get_all_render_code_cells();

        if !code.is_empty()
            && let Ok(render_code_cells) = serde_json::to_vec(&code)
        {
            crate::wasm_bindings::js::jsSheetCodeCells(self.id.to_string(), render_code_cells);
        }
    }

    /// Send images in this sheet to the client. Note: we only have images
    /// inside CodeRuns. We may open this up in the future to allow images to be
    /// placed directly on the grid without a CodeRun. In that case, we'll need
    /// to search the columns for images as well.
    pub fn send_all_images(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        self.data_tables
            .expensive_iter()
            .for_each(|(pos, data_table)| {
                if let Some(CellValue::Image(image)) = data_table.cell_value_at(0, 0) {
                    let cell_size = data_table.chart_output;
                    crate::wasm_bindings::js::jsSendImage(
                        self.id.to_string(),
                        pos.x as i32,
                        pos.y as i32,
                        cell_size.map(|(w, _)| w as i32).unwrap_or(0),
                        cell_size.map(|(_, h)| h as i32 + 1).unwrap_or(0),
                        Some(image),
                    );
                }
            });
    }

    /// Sends an image to the client.
    pub fn send_image(&self, pos: Pos) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let mut sent = false;
        if let Some(table) = self.data_table_at(&pos)
            && let Some(CellValue::Image(image)) = table.cell_value_at(0, 0)
        {
            let output_size = table.chart_output;
            crate::wasm_bindings::js::jsSendImage(
                self.id.to_string(),
                pos.x as i32,
                pos.y as i32,
                output_size.map(|(w, _)| w as i32).unwrap_or(0),
                output_size.map(|(_, h)| h as i32 + 1).unwrap_or(0),
                Some(image),
            );
            sent = true;
        }
        if !sent {
            crate::wasm_bindings::js::jsSendImage(
                self.id.to_string(),
                pos.x as i32,
                pos.y as i32,
                0,
                0,
                None,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Rect, SheetPos,
        a1::A1Context,
        controller::{
            GridController,
            transaction_types::{JsCellValueResult, JsCodeResult},
        },
        grid::{CodeRun, DataTableKind, js_types::JsNumber},
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count},
    };

    use super::*;

    #[test]
    fn test_get_html_output() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Python,
            "<html></html>".to_string(),
            None,
            None,
            false,
        );
        let transaction_id = gc.async_transactions()[0].id;
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("<html></html>".into(), 1)),
            ..Default::default()
        })
        .ok();
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_html_output();
        assert_eq!(render_cells.len(), 1);
        assert_eq!(
            render_cells[0],
            JsHtmlOutput {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                w: 7,
                h: 23,
                html: Some("<html></html>".to_string()),
                show_name: true,
                name: "Python1".to_string(),
                chart_image: None,
            }
        );
        gc.set_chart_size(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            1,
            2,
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let render_cells = sheet.get_html_output();
        assert_eq!(render_cells.len(), 1);
        assert_eq!(
            render_cells[0],
            JsHtmlOutput {
                sheet_id: sheet.id.to_string(),
                x: 1,
                y: 2,
                w: 1,
                h: 3,
                html: Some("<html></html>".to_string()),
                show_name: true,
                name: "Python1".to_string(),
                chart_image: None,
            }
        );
    }

    #[test]
    fn test_get_render_code_cells() {
        let sheet = Sheet::test();
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
        };

        // data_table is always 3x2
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(vec![vec!["1", "2", "3"], vec!["4", "5", "6"]].into()),
            false,
            Some(false),
            Some(false),
            None,
        );

        let context = A1Context::default();

        // render rect is larger than code rect
        // Note: DataTable cells don't populate language (table border drawn from table struct)
        let code_cells = sheet.get_render_code_cells(
            &data_table,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 3, 2),
            &context,
        );
        assert_eq!(code_cells.len(), 6);
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, None);
        assert_eq!(code_cells[0].number, None);
        assert_eq!(code_cells[5].value, "6".to_string());
        assert_eq!(code_cells[5].language, None);

        // code rect overlaps render rect to the top-left
        let code_cells = sheet.get_render_code_cells(
            &data_table,
            &Rect::from_numbers(2, 1, 10, 10),
            &Rect::from_numbers(0, 0, 3, 2),
            &context,
        );
        assert_eq!(code_cells.len(), 1);
        assert_eq!(code_cells[0].value, "6".to_string());
        assert_eq!(code_cells[0].language, None);

        // code rect overlaps render rect to the bottom-right
        let code_cells = sheet.get_render_code_cells(
            &data_table,
            &Rect::from_numbers(0, 0, 3, 2),
            &Rect::from_numbers(2, 1, 10, 10),
            &context,
        );
        assert_eq!(code_cells.len(), 1);
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, None);

        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        let code_run = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(1.into())),
            false,
            Some(false),
            Some(false),
            None,
        );
        let code_cells = sheet.get_render_code_cells(
            &code_run,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 1, 1),
            &context,
        );
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, None); // DataTable cells don't populate language
        assert_eq!(
            code_cells[0].number,
            Some(JsNumber {
                decimals: None,
                commas: None,
                format: None
            })
        );
    }

    #[test]
    fn test_render_code_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (0, 0).into();
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "1 + 1".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(2.into())),
            false,
            None,
            None,
            None,
        );

        sheet.set_data_table(pos, Some(data_table));
        let rendering = sheet.get_render_code_cell(pos);
        let last_modified = rendering.as_ref().unwrap().last_modified;
        assert_eq!(
            rendering,
            Some(JsRenderCodeCell {
                x: 0,
                y: 0,
                w: 1,
                h: 1,
                language: CodeCellLanguage::Python,
                state: crate::grid::js_types::JsRenderCodeCellState::Success,
                spill_error: None,
                name: "Table 1".to_string(),
                columns: vec![], // single values don't have column headers
                first_row_header: false,
                show_name: false,
                show_columns: false,
                sort: None,
                sort_dirty: false,
                alternating_colors: true,
                is_code: true,
                is_html: false,
                is_html_image: false,
                last_modified,
            })
        );
    }

    #[test]
    fn test_render_images() {
        clear_js_calls();
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // ensure nothing is sent when no images are in the sheet
        let sheet = gc.sheet(sheet_id);
        sheet.send_all_images();
        expect_js_call_count("jsSendImage", 0, false);

        // add an image to a code run and then send it to the client
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (1, 1).into();
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("image".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Image("image".to_string())),
            false,
            Some(false),
            Some(false),
            None,
        );
        sheet.set_data_table(pos, Some(data_table));
        sheet.send_all_images();
        expect_js_call(
            "jsSendImage",
            format!(
                "{},{},{},{:?},{},{}",
                sheet_id, pos.x as u32, pos.y as u32, true, 0, 0
            ),
            true,
        );
    }

    #[test]
    fn test_send_image() {
        let mut sheet = Sheet::test();
        let sheet_id = sheet.id;
        let pos = pos![A1];
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "".to_string(),
            formula_ast: None,
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("image".into()),
            line_number: None,
            output_type: None,
        };
        sheet.set_data_table(
            pos,
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run),
                "Table 1",
                Value::Single(CellValue::Image("image".to_string())),
                false,
                Some(true),
                Some(true),
                None,
            )),
        );
        sheet.send_image(pos);
        expect_js_call(
            "jsSendImage",
            format!(
                "{},{},{},{},{},{:?}",
                sheet_id, pos.x as u32, pos.y as u32, true, 0, 0
            ),
            true,
        );
    }
}
