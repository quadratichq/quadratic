use crate::grid::js_types::JsHashRenderFills;
use quadratic_core_shared::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH};

#[cfg(target_family = "wasm")]
use js_sys::SharedArrayBuffer;
#[cfg(target_family = "wasm")]
use quadratic_core_shared::ViewportBuffer;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Set the viewport buffer from TypeScript.
    /// This SharedArrayBuffer is shared between the client and Rust for
    /// communicating viewport state without message passing.
    #[cfg(target_family = "wasm")]
    #[wasm_bindgen(js_name = "setViewportBuffer")]
    pub fn set_viewport_buffer_wasm(&mut self, buffer: SharedArrayBuffer) {
        self.set_viewport_buffer(Some(ViewportBuffer::from_buffer(buffer)));
    }
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
        sheet.send_validation_warnings_rect(rect, true);
        let output = sheet.get_render_cells(rect, self.a1_context());
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

        let mut result = Vec::new();
        for hash in hashes {
            let rect = Rect::from_numbers(
                hash.x * CELL_SHEET_WIDTH as i64,
                hash.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );
            result.push(JsHashRenderFills {
                sheet_id,
                hash,
                fills: sheet.get_render_fills_in_rect(rect),
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

    /// Send meta fills (row/column/sheet fills) to the rust renderer.
    #[wasm_bindgen(js_name = "sendSheetMetaFillsToRustRenderer")]
    pub fn send_sheet_meta_fills_to_rust_renderer(&self, sheet_id: String) {
        use quadratic_core_shared::{CoreToRenderer, SheetFill, serialization};

        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return;
        };
        let Ok(shared_sheet_id) = quadratic_core_shared::SheetId::from_str(&sheet_id) else {
            return;
        };

        let fills = sheet.get_all_sheet_fills();

        // Convert to shared types
        let shared_fills: Vec<SheetFill> = fills
            .iter()
            .map(|f| SheetFill {
                x: f.x,
                y: f.y,
                w: f.w,
                h: f.h,
                color: f.color.clone(),
            })
            .collect();

        // Serialize the fills
        let Ok(fills_bytes) = serialization::serialize(&shared_fills) else {
            return;
        };

        // Create the message
        let message = CoreToRenderer::SheetMetaFills {
            sheet_id: shared_sheet_id,
            fills_bytes,
        };

        // Serialize and send
        if let Ok(bytes) = serialization::serialize(&message) {
            crate::wasm_bindings::js::jsSendToRustRenderer(bytes);
        }
    }
}
