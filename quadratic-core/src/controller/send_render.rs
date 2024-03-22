use std::collections::HashSet;

use crate::{
    grid::{js_types::JsRenderFill, SheetId},
    wasm_bindings::controller::sheet_info::SheetBounds,
    Pos, Rect, SheetRect,
};

use super::{
    transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    GridController,
};

impl GridController {
    /// Sends the modified cell sheets to the render web worker
    pub fn send_render_cells(&self, sheet_rect: &SheetRect) {
        if !cfg!(target_family = "wasm") {
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
        if !cfg!(target_family = "wasm") {
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

    /// Recalculates sheet bounds, and if changed then sends to TS.
    pub fn send_updated_bounds(&mut self, sheet_id: SheetId) {
        let recalculated = if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.recalculate_bounds()
        } else {
            false
        };

        if !cfg!(target_family = "wasm") {
            return;
        }

        if recalculated {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let Ok(sheet_info) = serde_json::to_string(&SheetBounds::from(sheet)) {
                    crate::wasm_bindings::js::jsSheetBoundsUpdate(sheet_info);
                }
            }
        };
    }
}
