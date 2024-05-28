use super::Sheet;
use crate::{
    controller::transaction_summary::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    Pos, Rect,
};
use std::collections::HashSet;

impl Sheet {
    /// Sends the modified cell sheets to the render web worker
    pub fn send_render_cells(&self, positions: &HashSet<Pos>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        // calculate the hashes that were updated
        let mut modified = HashSet::new();
        positions.iter().for_each(|pos| {
            let x_hash = (pos.x as f64 / CELL_SHEET_WIDTH as f64).floor() as i64;
            let y_hash = (pos.y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i64;
            modified.insert(Pos {
                x: x_hash,
                y: y_hash,
            });
        });

        // send the modified cells to the render web worker
        modified.iter().for_each(|modified| {
            let rect = Rect::from_numbers(
                modified.x * CELL_SHEET_WIDTH as i64,
                modified.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );
            let render_cells = self.get_render_cells(rect);
            if let Ok(cells) = serde_json::to_string(&render_cells) {
                crate::wasm_bindings::js::jsRenderCellSheets(
                    self.id.to_string(),
                    modified.x,
                    modified.y,
                    cells,
                );
            }
        });
    }

    /// Sends html output to the client within a sheetRect
    pub fn send_html_output(&self, positions: &HashSet<Pos>) {
        if cfg!(target_family = "wasm") | cfg!(test) {
            positions.iter().for_each(|pos| {
                if let Some(html_output) = self.get_single_html_output(*pos) {
                    if let Ok(html) = serde_json::to_string(&html_output) {
                        crate::wasm_bindings::js::jsUpdateHtml(html);
                    }
                }
            });
        }
    }

    /// Sends all fills to the client. TODO: the fills should be sent in
    /// batches instead of for the entire sheet.
    pub fn send_fills(&self, fills: &HashSet<Pos>) {
        // this is needed to prevent sending when no fills have changed. See TODO.
        if fills.is_empty() {
            return;
        }
        if cfg!(target_family = "wasm") | cfg!(test) {
            let fills = self.get_all_render_fills();
            if let Ok(fills) = serde_json::to_string(&fills) {
                crate::wasm_bindings::js::jsSheetFills(self.id.to_string(), fills);
            }
        }
    }
}

#[cfg(test)]
mod test {
    use crate::CellValue;

    use super::*;

    #[test]
    fn send_render_cells() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Text("test".to_string()));
    }
}
