//! Code and html/image output for client rendering.

use crate::{
    grid::{
        js_types::{JsHtmlOutput, JsRenderCodeCell, JsRenderCodeCellState},
        CodeCellLanguage, DataTable, DataTableShowUI, Sheet,
    },
    CellValue, Pos, Value,
};

impl Sheet {
    pub fn get_single_html_output(&self, pos: Pos) -> Option<JsHtmlOutput> {
        let run = self.data_tables.get(&pos)?;
        if !run.is_html() {
            return None;
        }
        let size = run.chart_pixel_output;
        let output = run.cell_value_at(0, 0)?;
        dbgjs!(format!("get_single_html_output size: {:?}", size));
        Some(JsHtmlOutput {
            sheet_id: self.id.to_string(),
            x: pos.x,
            y: pos.y,
            html: Some(output.to_display()),
            w: size.map(|(w, _)| w),
            h: size.map(|(_, h)| h),
        })
    }

    pub fn get_html_output(&self) -> Vec<JsHtmlOutput> {
        self.data_tables
            .iter()
            .filter_map(|(pos, run)| {
                let output = run.cell_value_at(0, 0)?;
                if !matches!(output, CellValue::Html(_)) {
                    return None;
                }
                let size = run.chart_pixel_output;
                Some(JsHtmlOutput {
                    sheet_id: self.id.to_string(),
                    x: pos.x,
                    y: pos.y,
                    html: Some(output.to_display()),
                    w: size.map(|(w, _)| w),
                    h: size.map(|(_, h)| h),
                })
            })
            .collect()
    }

    // Returns data for rendering a code cell.
    fn render_code_cell(&self, pos: Pos, data_table: &DataTable) -> Option<JsRenderCodeCell> {
        let code = self.cell_value(pos)?;
        let output_size = data_table.output_size(true);
        let (state, w, h, spill_error) = if data_table.spill_error {
            let reasons =
                self.find_spill_error_reasons(&data_table.output_rect(pos, true, true), pos);
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
        let alternating_colors = !data_table.spill_error
            && !data_table.has_error()
            && !data_table.is_image()
            && !data_table.is_html()
            && data_table.alternating_colors;

        let language = match code {
            CellValue::Code(code) => code.language,
            CellValue::Import(_) => CodeCellLanguage::Import,
            _ => return None,
        };
        Some(JsRenderCodeCell {
            x: pos.x as i32,
            y: pos.y as i32,
            w,
            h,
            show_ui: match data_table.show_ui {
                // show UI for non-formula code cells by default
                DataTableShowUI::Default => language != CodeCellLanguage::Formula,
                DataTableShowUI::Show => true,
                DataTableShowUI::Hide => false,
            },
            language,
            state,
            spill_error,
            name: data_table.name.clone(),
            columns: data_table.send_columns(),
            first_row_header: data_table.header_is_first_row,
            show_header: data_table.show_header,
            sort: data_table.sort.clone(),
            alternating_colors,
            readonly: data_table.readonly,
            is_html_image: data_table.is_html() || data_table.is_image(),
        })
    }

    // Returns a single code cell for rendering.
    pub fn get_render_code_cell(&self, pos: Pos) -> Option<JsRenderCodeCell> {
        let data_table = self.data_tables.get(&pos)?;
        self.render_code_cell(pos, data_table)
    }

    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.data_tables
            .iter()
            .filter_map(|(pos, data_table)| self.render_code_cell(*pos, data_table))
            .collect()
    }

    /// Send images in this sheet to the client. Note: we only have images
    /// inside CodeRuns. We may open this up in the future to allow images to be
    /// placed directly on the grid without a CodeRun. In that case, we'll need
    /// to search the columns for images as well.
    pub fn send_all_images(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        self.data_tables.iter().for_each(|(pos, data_table)| {
            if let Some(CellValue::Image(image)) = data_table.cell_value_at(0, 0) {
                let size = data_table.chart_pixel_output;
                dbgjs!(format!("send_all_images size: {:?}", size));
                crate::wasm_bindings::js::jsSendImage(
                    self.id.to_string(),
                    pos.x as i32,
                    pos.y as i32,
                    Some(image),
                    size.map(|(w, _)| w),
                    size.map(|(_, h)| h),
                );
            }
        });
    }

    // Sends an update to a code cell. Sends a message regardless of whether the
    // code cell is still present.
    pub fn send_code_cell(&self, pos: Pos) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        if let (Some(code_cell), Some(render_code_cell)) =
            (self.edit_code_value(pos), self.get_render_code_cell(pos))
        {
            if let (Ok(code_cell), Ok(render_code_cell)) = (
                serde_json::to_string(&code_cell),
                serde_json::to_string(&render_code_cell),
            ) {
                crate::wasm_bindings::js::jsUpdateCodeCell(
                    self.id.to_string(),
                    pos.x,
                    pos.y,
                    Some(code_cell),
                    Some(render_code_cell),
                );
            }
        } else {
            crate::wasm_bindings::js::jsUpdateCodeCell(
                self.id.to_string(),
                pos.x,
                pos.y,
                None,
                None,
            );
        }
    }

    /// Sends an image to the client.
    pub fn send_image(&self, pos: Pos) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let mut sent = false;
        if let Some(table) = self.data_table(pos) {
            if let Some(CellValue::Image(image)) = table.cell_value_at(0, 0) {
                let chart_size = table.chart_pixel_output;
                crate::wasm_bindings::js::jsSendImage(
                    self.id.to_string(),
                    pos.x as i32,
                    pos.y as i32,
                    Some(image),
                    chart_size.map(|(w, _)| w),
                    chart_size.map(|(_, h)| h),
                );
                sent = true;
            }
        }
        if !sent {
            crate::wasm_bindings::js::jsSendImage(
                self.id.to_string(),
                pos.x as i32,
                pos.y as i32,
                None,
                None,
                None,
            );
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{js_types::JsNumber, CodeCellValue, CodeRun, DataTableKind},
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count},
        Rect, SheetPos,
    };

    use serial_test::serial;

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
        );
        let transaction_id = gc.async_transactions()[0].id;
        gc.calculation_complete(JsCodeResult {
            transaction_id: transaction_id.to_string(),
            success: true,
            output_value: Some(vec!["<html></html>".into(), "text".into()]),
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
                html: Some("<html></html>".to_string()),
                w: None,
                h: None,
            }
        );
        gc.set_chart_size(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            1.0,
            2.0,
            None,
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
                html: Some("<html></html>".to_string()),
                w: Some(1.0),
                h: Some(2.0),
            }
        );
    }

    #[test]
    fn test_get_code_cells() {
        let sheet = Sheet::test();
        let code_cell = CellValue::Code(CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "".to_string(),
        });
        let code_run = CodeRun {
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
            false,
            false,
            None,
        );

        // render rect is larger than code rect
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &data_table,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 3, 2),
        );
        assert_eq!(code_cells.len(), 6);
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));
        assert_eq!(code_cells[0].number, None);
        assert_eq!(code_cells[5].value, "6".to_string());
        assert_eq!(code_cells[5].language, None);

        // code rect overlaps render rect to the top-left
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &data_table,
            &Rect::from_numbers(2, 1, 10, 10),
            &Rect::from_numbers(0, 0, 3, 2),
        );
        assert_eq!(code_cells.len(), 1);
        assert_eq!(code_cells[0].value, "6".to_string());
        assert_eq!(code_cells[0].language, None);

        // code rect overlaps render rect to the bottom-right
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &data_table,
            &Rect::from_numbers(0, 0, 3, 2),
            &Rect::from_numbers(2, 1, 10, 10),
        );
        assert_eq!(code_cells.len(), 1);
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));

        let code_run = CodeRun {
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
            false,
            false,
            None,
        );
        let code_cells = sheet.get_code_cells(
            &code_cell,
            &code_run,
            &Rect::from_numbers(0, 0, 10, 10),
            &Rect::from_numbers(5, 5, 1, 1),
        );
        assert_eq!(code_cells[0].value, "1".to_string());
        assert_eq!(code_cells[0].language, Some(CodeCellLanguage::Python));
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
    fn render_code_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (0, 0).into();
        let code = CellValue::Code(CodeCellValue {
            language: CodeCellLanguage::Python,
            code: "1 + 1".to_string(),
        });
        let code_run = CodeRun {
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
            false,
            true,
            None,
        );

        sheet.set_data_table(pos, Some(data_table));
        sheet.set_cell_value(pos, code);
        let rendering = sheet.get_render_code_cell(pos);
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
                show_header: true,
                sort: None,
                alternating_colors: true,
                readonly: true,
                is_html_image: false,
                show_ui: true,
            })
        );
    }

    #[test]
    #[serial]
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
        let pos = (0, 0).into();
        let image = "image".to_string();
        let code = CellValue::Image(image.clone());
        let code_run = CodeRun {
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
            Value::Single(CellValue::Image(image.clone())),
            false,
            false,
            false,
            None,
        );
        sheet.set_data_table(pos, Some(data_table));
        sheet.set_cell_value(pos, code);
        sheet.send_all_images();
        expect_js_call(
            "jsSendImage",
            format!(
                "{},{},{},{:?},{:?},{:?}",
                sheet_id, pos.x as u32, pos.y as u32, true, None::<String>, None::<String>
            ),
            true,
        );
    }

    #[test]
    #[serial]
    fn test_send_image() {
        let mut sheet = Sheet::test();
        let sheet_id = sheet.id;
        let pos = (0, 0).into();
        let code_run = CodeRun {
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
                false,
                true,
                None,
            )),
        );
        sheet.send_image(pos);
        expect_js_call(
            "jsSendImage",
            format!(
                "{},{},{},{:?},{:?},{:?}",
                sheet_id, pos.x as u32, pos.y as u32, true, None::<f32>, None::<f32>
            ),
            true,
        );
    }
}
