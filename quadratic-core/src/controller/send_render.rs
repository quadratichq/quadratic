use std::collections::HashSet;

use crate::{
    grid::{js_types::JsRenderFill, RenderSize, SheetId},
    selection::Selection,
    wasm_bindings::controller::sheet_info::{SheetBounds, SheetInfo},
    CellValue, Pos, Rect, SheetPos, SheetRect,
};

use super::{
    active_transactions::pending_transaction::PendingTransaction,
    transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    GridController,
};

impl GridController {
    fn send_render_cells_from_hash(&self, sheet_id: SheetId, modified: HashSet<Pos>) {
        // send the modified cells to the render web worker
        modified.iter().for_each(|modified| {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let rect = Rect::from_numbers(
                    modified.x * CELL_SHEET_WIDTH as i64,
                    modified.y * CELL_SHEET_HEIGHT as i64,
                    CELL_SHEET_WIDTH as i64,
                    CELL_SHEET_HEIGHT as i64,
                );
                let render_cells = sheet.get_render_cells(rect);
                if let Ok(cells) = serde_json::to_string(&render_cells) {
                    crate::wasm_bindings::js::jsRenderCellSheets(
                        sheet_id.to_string(),
                        modified.x,
                        modified.y,
                        cells,
                    );
                }
                sheet.send_validation_warnings(modified.x, modified.y, rect);
            }
        });
    }

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
        self.send_render_cells_from_hash(sheet_rect.sheet_id, modified);
    }

    /// Sends the modified cell sheets to the render web worker based on a
    /// selection.
    ///
    /// TODO: this is only implemented when only_rects == true; add
    /// only_rects == false when needed.
    pub fn send_render_cells_selection(&self, selection: &Selection, only_rects: bool) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }
        assert!(only_rects == true);
        let mut modified = HashSet::new();
        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                for y in rect.y_range() {
                    let y_hash = (y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i64;
                    for x in rect.x_range() {
                        let x_hash = (x as f64 / CELL_SHEET_WIDTH as f64).floor() as i64;
                        modified.insert(Pos {
                            x: x_hash,
                            y: y_hash,
                        });
                    }
                }
            }
        }
        self.send_render_cells_from_hash(selection.sheet_id, modified);
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

    pub fn send_updated_bounds_selection(&mut self, selection: &Selection, format: bool) {
        let recalculated = if let Some(sheet) = self.try_sheet_mut(selection.sheet_id) {
            sheet.recalculate_add_bounds_selection(selection, format)
        } else {
            false
        };

        if cfg!(target_family = "wasm") && recalculated {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
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

    /// Sends add sheet to the client
    pub fn send_add_sheet(&self, sheet_id: SheetId, transaction: &PendingTransaction) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let sheet_info = SheetInfo::from(sheet);
                if let Ok(sheet_info) = serde_json::to_string(&sheet_info) {
                    crate::wasm_bindings::js::jsAddSheet(
                        sheet_info,
                        transaction.is_user_undo_redo(),
                    );
                }
            }
        }
    }

    /// Sends delete sheet to the client
    pub fn send_delete_sheet(&self, sheet_id: SheetId, transaction: &PendingTransaction) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            crate::wasm_bindings::js::jsDeleteSheet(
                sheet_id.to_string(),
                transaction.is_user_undo_redo(),
            );
        }
    }

    /// Sends sheet info to the client
    pub fn send_sheet_info(&self, sheet_id: SheetId) {
        if cfg!(target_family = "wasm") || cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let sheet_info = SheetInfo::from(sheet);
                if let Ok(sheet_info) = serde_json::to_string(&sheet_info) {
                    crate::wasm_bindings::js::jsSheetInfoUpdate(sheet_info);
                }
            }
        }
    }

    pub fn send_image(&self, sheet_pos: SheetPos) {
        if cfg!(target_family = "wasm") || cfg!(test) {
            if let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) {
                let image = sheet.code_run(sheet_pos.into()).and_then(|code_run| {
                    code_run
                        .cell_value_at(0, 0)
                        .and_then(|cell_value| match cell_value {
                            CellValue::Image(image) => Some(image.clone()),
                            _ => None,
                        })
                });
                let (w, h) = if let Some(size) =
                    sheet.get_formatting_value::<RenderSize>(sheet_pos.into())
                {
                    (Some(size.w), Some(size.h))
                } else {
                    (None, None)
                };

                crate::wasm_bindings::js::jsSendImage(
                    sheet_pos.sheet_id.to_string(),
                    sheet_pos.x as i32,
                    sheet_pos.y as i32,
                    image,
                    w,
                    h,
                );
            }
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{transaction_types::JsCodeResult, GridController},
        grid::{
            js_types::{JsHtmlOutput, JsRenderCell},
            sheet::validations::{
                validation::Validation,
                validation_rules::{validation_logical::ValidationLogical, ValidationRule},
            },
            RenderSize, SheetId,
        },
        selection::Selection,
        wasm_bindings::js::{expect_js_call, hash_test},
        Rect,
    };
    use serial_test::serial;
    use uuid::Uuid;

    #[test]
    #[serial]
    fn send_render_cells() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::test();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        gc.set_cell_value((0, 0, sheet_id).into(), "test 1".to_string(), None);
        let result = vec![JsRenderCell {
            value: "test 1".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&result)),
            true,
        );

        gc.set_cell_value((100, 100, sheet_id).into(), "test 2".to_string(), None);
        let result = vec![JsRenderCell {
            x: 100,
            y: 100,
            value: "test 2".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 6, 3, hash_test(&result)),
            true,
        );
    }

    #[test]
    #[serial]
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
            true,
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
            true,
        );
    }

    #[test]
    #[serial]
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
            std_err: None,
            std_out: None,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            output_array: None,
            line_number: None,
            output_display_type: None,
            cancel_compute: None,
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
            true,
        );
    }

    #[test]
    #[serial]
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
            std_err: None,
            std_out: None,
            output_value: Some(vec!["<html></html>".to_string(), "text".to_string()]),
            output_array: None,
            line_number: None,
            output_display_type: None,
            cancel_compute: None,
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
            true,
        );
    }

    #[test]
    #[serial]
    fn send_render_cells_from_rects() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::new();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        gc.set_cell_value((0, 0, sheet_id).into(), "test 1".to_string(), None);
        gc.set_cell_value((100, 100, sheet_id).into(), "test 2".to_string(), None);

        let result = vec![JsRenderCell {
            value: "test 1".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&result)),
            false,
        );

        let result = vec![JsRenderCell {
            x: 100,
            y: 100,
            value: "test 2".to_string(),
            ..Default::default()
        }];
        let result = serde_json::to_string(&result).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 6, 3, hash_test(&result)),
            true,
        );
    }

    #[test]
    #[serial]
    fn send_render_cells_selection() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::new();
        gc.sheet_mut(gc.sheet_ids()[0]).id = sheet_id;

        let rect = Rect::new(1, 1, 2, 2);
        let selection = Selection::rect(rect.clone(), sheet_id);
        gc.update_validation(
            Validation {
                id: Uuid::new_v4(),
                selection: selection.clone(),
                rule: ValidationRule::Logical(ValidationLogical {
                    show_checkbox: true,
                    ignore_blank: true,
                }),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let send = serde_json::to_string(&sheet.get_render_cells(rect)).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&send)),
            true,
        );
    }
}
