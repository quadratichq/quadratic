use std::collections::HashSet;

use crate::{
    grid::{js_types::JsRenderFill, SheetId},
    wasm_bindings::controller::sheet_info::SheetBounds,
    Pos, Rect, SheetPos, SheetRect,
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
        if cfg!(target_family = "wasm") {
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
}

#[cfg(test)]
mod test {
    use crate::{controller::GridController, grid::SheetId, wasm_bindings::js::expect_js_call};

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
}
