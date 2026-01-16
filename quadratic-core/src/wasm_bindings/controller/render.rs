use crate::{
    grid::js_types::{JsHashRenderFills, JsRenderFill},
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
};

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    ///
    /// Returns a string containing a JSON array of [`JsRenderCell`].
    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: String, rect: String) -> Vec<u8> {
        let Ok(rect) = serde_json::from_str::<Rect>(&rect) else {
            return vec![];
        };
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return vec![];
        };
        let sheet_id_parsed = sheet.id;
        sheet.send_validation_warnings_rect(rect, true);
        let mut output = sheet.get_render_cells(rect, self.a1_context());

        // Apply conditional formatting to render cells
        self.apply_conditional_formatting_to_cells(sheet_id_parsed, rect, &mut output);

        serde_json::to_vec(&output).unwrap_or_default()
    }

    /// Returns fill data for the specified hashes.
    ///
    /// hashes_json is a JSON array of {x, y} hash coordinates.
    /// Returns a JSON array of [`JsHashRenderFills`].
    #[wasm_bindgen(js_name = "getRenderFillsForHashes")]
    pub fn get_render_fills_for_hashes(&self, sheet_id: String, hashes_json: String) -> Vec<u8> {
        let Ok(hashes) = serde_json::from_str::<Vec<Pos>>(&hashes_json) else {
            return vec![];
        };
        let Some(sheet_id) = SheetId::from_str(&sheet_id).ok() else {
            return vec![];
        };
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return vec![];
        };

        let a1_context = self.a1_context();
        let mut result = Vec::new();
        for hash in hashes {
            let rect = Rect::from_numbers(
                hash.x * CELL_SHEET_WIDTH as i64,
                hash.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );
            let mut fills = sheet.get_render_fills_in_rect(rect);

            // Add conditional format fills
            let cf_fills = self.get_conditional_format_fills(sheet_id, rect, a1_context);
            for (fill_rect, color) in cf_fills {
                fills.push(JsRenderFill {
                    x: fill_rect.min.x,
                    y: fill_rect.min.y,
                    w: fill_rect.width(),
                    h: fill_rect.height(),
                    color,
                });
            }

            result.push(JsHashRenderFills {
                sheet_id,
                hash,
                fills,
            });
        }

        serde_json::to_vec(&result).unwrap_or_default()
    }

    /// Returns meta fills (row/column/sheet fills) for a sheet.
    ///
    /// Returns a JSON array of [`JsSheetFill`].
    #[wasm_bindgen(js_name = "getSheetMetaFills")]
    pub fn get_sheet_meta_fills(&self, sheet_id: String) -> Vec<u8> {
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return vec![];
        };
        let fills = sheet.get_all_sheet_fills();
        serde_json::to_vec(&fills).unwrap_or_default()
    }
}
