use std::collections::HashSet;

use crate::{Pos, Rect, SheetRect};

use super::{
    transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    GridController,
};

impl GridController {
    /// Sends the modified cell sheets to the render web worker
    pub fn send_render_cells(&self, sheet_rect: &SheetRect) {
        // nothing to do if we're in a test
        if cfg!(test) || cfg!(feature = "files") || cfg!(feature = "multiplayer") {
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
}
