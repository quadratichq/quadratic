use std::collections::HashSet;

use crate::{
    grid::{js_types::JsRenderFill, SheetId},
    wasm_bindings::controller::sheet_info::SheetBounds,
    CellValue, Pos, Rect, SheetPos, SheetRect,
};

use super::{
    transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    GridController,
};

impl GridController {
    /// Sends the modified cell sheets to the render web worker
    pub fn send_render_cells(&self, sheet_rect: &SheetRect) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        // calculate the hashes that were updated
        let mut modified = HashSet::new();
        for y in sheet_rect.y_range() {
            let y_hash = (y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i64;
            for x in sheet_rect.x_range() {
                let x_hash = (x as f64 / CELL_SHEET_WIDTH as f64).floor() as i64;
                modified.insert(Pos {
                    x: x_hash,
                    y: y_hash,
                });
            }
        }
        // send the modified cells to the render web worker
        modified.iter().for_each(|modified| {
            if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
                let rect = Rect::from_numbers(
                    modified.x * CELL_SHEET_WIDTH as i64,
                    modified.y * CELL_SHEET_HEIGHT as i64,
                    CELL_SHEET_WIDTH as i64,
                    CELL_SHEET_HEIGHT as i64,
                );
                let render_cells = sheet.get_render_cells(rect);
                if let Ok(cells) = serde_json::to_string(&render_cells) {
                    crate::wasm_bindings::js::jsRenderCellSheets(
                        sheet_rect.sheet_id.to_string(),
                        modified.x,
                        modified.y,
                        cells,
                    );
                }
            }
        });
    }

    /// Sends the modified fills to the client
    pub fn send_fill_cells(&self, sheet_rect: &SheetRect) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }
        if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
            let fills = sheet.get_all_render_fills();
            if let Ok(fills) = serde_json::to_string(&fills) {
                crate::wasm_bindings::js::jsSheetFills(sheet_rect.sheet_id.to_string(), fills);
            }
        }
    }

    /// Sends all fills to the client
    pub fn sheet_fills(&self, sheet_id: SheetId) -> Vec<JsRenderFill> {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            sheet.get_all_render_fills()
        } else {
            Vec::new()
        }
    }

    pub fn send_updated_bounds_rect(&mut self, sheet_rect: &SheetRect, format: bool) {
        let recalculated = if let Some(sheet) = self.try_sheet_mut(sheet_rect.sheet_id) {
            sheet.recalculate_add_bounds((*sheet_rect).into(), format)
        } else {
            false
        };

        if cfg!(target_family = "wasm") && recalculated {
            if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
                if let Ok(sheet_info) = serde_json::to_string(&SheetBounds::from(sheet)) {
                    crate::wasm_bindings::js::jsSheetBoundsUpdate(sheet_info);
                }
            }
        };
    }

    /// Recalculates sheet bounds, and if changed then sends to TS.
    pub fn send_updated_bounds(&mut self, sheet_id: SheetId) {
        let recalculated = if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.recalculate_bounds()
        } else {
            false
        };

        if cfg!(target_family = "wasm") && recalculated {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let Ok(sheet_info) = serde_json::to_string(&SheetBounds::from(sheet)) {
                    crate::wasm_bindings::js::jsSheetBoundsUpdate(sheet_info);
                }
            }
        };
    }

    /// Sends html output to the client within a sheetRect
    pub fn send_html_output_rect(&self, sheet_rect: &SheetRect) {
        if cfg!(target_family = "wasm") | cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
                sheet
                    .get_html_output()
                    .iter()
                    .filter(|html_output| {
                        sheet_rect.contains(SheetPos {
                            sheet_id: sheet_rect.sheet_id,
                            x: html_output.x,
                            y: html_output.y,
                        })
                    })
                    .for_each(|html_output| {
                        if let Ok(html) = serde_json::to_string(&html_output) {
                            crate::wasm_bindings::js::jsUpdateHtml(html);
                        }
                    });
            }
        }
    }

    /// Sends a single image to the client
    pub fn sheet_image(
        sheet_id: SheetId,
        x: i64,
        y: i64,
        image: Option<Vec<u8>>,
        w: Option<u32>,
        h: Option<u32>,
    ) {
        crate::wasm_bindings::js::jsUpdateImage(sheet_id.to_string(), x, y, image, w, h);
    }

    /// Sends all images to the client
    pub fn sheet_images(&self, sheet_id: SheetId) {
        if cfg!(target_family = "wasm") | cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                sheet.code_runs.iter().for_each(|(pos, code_run)| {
                    if let Some(value) = code_run.cell_value_at(0, 0) {
                        match value {
                            CellValue::Image(image) => {
                                Self::sheet_image(
                                    sheet_id,
                                    pos.x,
                                    pos.y,
                                    Some(image.data),
                                    image.w,
                                    image.h,
                                );
                            }
                            _ => {}
                        }
                    }
                });
            }
        }
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use crate::{
        cellvalue::ImageCellValue,
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{js_types::JsHtmlOutput, CodeRun, CodeRunResult, RenderSize, SheetId},
        wasm_bindings::js::expect_js_call,
        CellValue, Value,
    };

    #[test]
    fn send_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::test();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        gc.set_cell_value((0, 0, sheet_id).into(), "test 1".to_string(), None);
        expect_js_call(
            "jsRenderCellSheets",
            format!(
                "{},{},{},{}",
                sheet_id, 0, 0, r#"[{"x":0,"y":0,"value":"test 1","special":null}]"#
            ),
        );

        gc.set_cell_value((100, 100, sheet_id).into(), "test 2".to_string(), None);
        expect_js_call(
            "jsRenderCellSheets",
            format!(
                "{},{},{},{}",
                sheet_id, 6, 3, r#"[{"x":100,"y":100,"value":"test 2","special":null}]"#
            ),
        );
    }

    #[test]
    fn send_fill_cells() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::test();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        gc.set_cell_fill_color((0, 0, 1, 1, sheet_id).into(), Some("red".to_string()), None);
        expect_js_call(
            "jsSheetFills",
            format!(
                "{},{}",
                sheet_id, r#"[{"x":0,"y":0,"w":1,"h":1,"color":"red"}]"#
            ),
        );

        gc.set_cell_fill_color(
            (100, 100, 1, 1, sheet_id).into(),
            Some("green".to_string()),
            None,
        );
        expect_js_call(
            "jsSheetFills",
            format!(
                "{},{}",
                sheet_id,
                r#"[{"x":0,"y":0,"w":1,"h":1,"color":"red"},{"x":100,"y":100,"w":1,"h":1,"color":"green"}]"#
            ),
        );
    }

    #[test]
    fn send_html_output_rect() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::test();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            crate::grid::CodeCellLanguage::Python,
            "test".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id.to_string();
        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id,
            success: true,
            error_msg: None,
            input_python_std_out: None,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            array_output: None,
            line_number: None,
            output_type: None,
            cancel_compute: None,
            output_bytes: None,
        });

        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&JsHtmlOutput {
                sheet_id: sheet_id.to_string(),
                x: 0,
                y: 0,
                html: Some("<html></html>".to_string()),
                w: None,
                h: None,
            })
            .unwrap(),
        );
    }

    #[test]
    fn send_html_output_rect_after_resize() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::test();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            crate::grid::CodeCellLanguage::Python,
            "test".to_string(),
            None,
        );
        let transaction_id = gc.last_transaction().unwrap().id.to_string();
        let _ = gc.calculation_complete(JsCodeResult {
            transaction_id,
            success: true,
            error_msg: None,
            input_python_std_out: None,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            array_output: None,
            line_number: None,
            output_type: None,
            cancel_compute: None,
            output_bytes: None,
        });

        gc.set_cell_render_size(
            (0, 0, 1, 1, sheet_id).into(),
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            }),
            None,
        );

        expect_js_call(
            "jsUpdateHtml",
            serde_json::to_string(&JsHtmlOutput {
                sheet_id: sheet_id.to_string(),
                x: 0,
                y: 0,
                html: Some("<html></html>".to_string()),
                w: Some("1".to_string()),
                h: Some("2".to_string()),
            })
            .unwrap(),
        );
    }

    #[test]
    fn sheet_images() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::test();
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);
        sheet.id = sheet_id;

        sheet.code_runs.insert(
            (0, 0).into(),
            CodeRun {
                formatted_code_string: None,
                std_out: None,
                std_err: None,
                cells_accessed: HashSet::new(),
                result: CodeRunResult::Ok(Value::Single(CellValue::Image(ImageCellValue {
                    data: vec![1, 2, 3, 4],
                    w: Some(1),
                    h: Some(2),
                }))),
                return_type: None,
                line_number: None,
                output_type: None,
                spill_error: false,
                last_modified: chrono::Utc::now(),
            },
        );

        sheet.code_runs.insert(
            (1, 2).into(),
            CodeRun {
                formatted_code_string: None,
                std_out: None,
                std_err: None,
                cells_accessed: HashSet::new(),
                result: CodeRunResult::Ok(Value::Single(CellValue::Image(ImageCellValue {
                    data: vec![2, 3, 4, 5],
                    w: None,
                    h: None,
                }))),
                return_type: None,
                line_number: None,
                output_type: None,
                spill_error: false,
                last_modified: chrono::Utc::now(),
            },
        );

        gc.sheet_images(sheet_id);

        expect_js_call(
            "jsUpdateImage",
            format!(
                "{},{},{},{:?},{:?},{:?}",
                sheet_id,
                0,
                0,
                Some(vec![1, 2, 3, 4]),
                Some(1),
                Some(2)
            ),
        );

        expect_js_call(
            "jsUpdateImage",
            format!(
                "{},{},{},{:?},{:?},{:?}",
                sheet_id,
                1,
                2,
                Some(vec![2, 3, 4, 5]),
                None::<u32>,
                None::<u32>
            ),
        );
    }
}
