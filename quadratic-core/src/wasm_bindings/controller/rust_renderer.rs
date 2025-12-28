//! Functions for sending data to the Rust renderer.
//!
//! These functions serialize data using bincode and send it via JS callback
//! to the rust renderer worker.

use std::str::FromStr;

use super::*;
use crate::grid::SheetId;
use quadratic_core_shared::{CoreToRenderer, serialization};

#[wasm_bindgen]
impl GridController {
    /// Send sheet offsets to the rust renderer.
    /// This should be called when:
    /// - A file is loaded with the rust renderer enabled
    /// - Column/row sizes change
    /// - Switching to a different sheet
    #[wasm_bindgen(js_name = "sendSheetOffsetsToRustRenderer")]
    pub fn js_send_sheet_offsets_to_rust_renderer(&self, sheet_id: String) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid sheet_id: {e}")))?;

        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;

        // Convert to shared SheetId for the message
        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| JsValue::from_str(&format!("Invalid sheet_id: {e}")))?;

        // Serialize the SheetOffsets to bincode bytes
        // Core's SheetOffsets and core-shared's SheetOffsets are structurally identical,
        // so bincode encoding from one can be decoded as the other
        let offsets_bytes = serialization::serialize(&sheet.offsets)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize offsets: {e}")))?;

        // Create the message with the serialized offsets
        let message = CoreToRenderer::SheetOffsets {
            sheet_id: shared_sheet_id,
            offsets_bytes,
        };

        // Serialize the message to bincode
        let bytes = serialization::serialize(&message)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize message: {e}")))?;

        // Send to rust renderer via JS callback
        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }

    /// Send all sheet offsets to the rust renderer (for all sheets).
    /// This should be called when a file is loaded with the rust renderer enabled.
    #[wasm_bindgen(js_name = "sendAllSheetOffsetsToRustRenderer")]
    pub fn js_send_all_sheet_offsets_to_rust_renderer(&self) -> Result<(), JsValue> {
        for sheet_id in self.sheet_ids() {
            self.js_send_sheet_offsets_to_rust_renderer(sheet_id.to_string())?;
        }
        Ok(())
    }
}
