//! Functions for sending data to the Rust renderer.
//!
//! These functions serialize data using bincode and send it via JS callback
//! to the rust renderer worker.

use std::str::FromStr;

use super::*;
use crate::grid::SheetId;
use crate::wasm_bindings::js::log;
use quadratic_core_shared::{CoreToRenderer, SheetInfo, serialization};

impl GridController {
    /// Internal: Send complete sheet info (metadata + offsets) to the rust renderer.
    pub fn send_sheet_info_to_rust_renderer(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        // Convert to shared SheetId for the message
        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Serialize the SheetOffsets to bincode bytes
        let offsets_bytes = serialization::serialize(&sheet.offsets)
            .map_err(|e| format!("Failed to serialize offsets: {e}"))?;

        // Create SheetInfo with all metadata and offsets
        let sheet_info = SheetInfo {
            sheet_id: shared_sheet_id,
            name: sheet.name.clone(),
            order: sheet.order.clone(),
            color: sheet
                .color
                .as_ref()
                .and_then(|c| quadratic_core_shared::Rgba::from_hex(c)),
            offsets_bytes,
        };

        // Create the message
        let message = CoreToRenderer::SheetInfo(sheet_info);

        // Serialize the message to bincode
        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        log(&format!(
            "[rust_renderer] Sending SheetInfo '{}' ({} bytes) to renderer",
            sheet.name,
            bytes.len()
        ));

        // Send to rust renderer via JS callback
        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }

    /// Internal: Send sheet info for all sheets to the rust renderer.
    /// This is called automatically when a file is loaded.
    pub fn send_all_sheet_info_to_rust_renderer(&self) -> Result<(), String> {
        let sheet_ids = self.sheet_ids();
        log(&format!(
            "[rust_renderer] Sending all sheet info to renderer ({} sheets)",
            sheet_ids.len()
        ));
        for sheet_id in sheet_ids {
            self.send_sheet_info_to_rust_renderer(sheet_id)?;
        }
        log("[rust_renderer] All sheet info sent to renderer");
        Ok(())
    }

    /// Internal: Send sheet offsets to the rust renderer.
    pub fn send_sheet_offsets_to_rust_renderer(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        // Convert to shared SheetId for the message
        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Serialize the SheetOffsets to bincode bytes
        let offsets_bytes = serialization::serialize(&sheet.offsets)
            .map_err(|e| format!("Failed to serialize offsets: {e}"))?;

        // Create the message with the serialized offsets
        let message = CoreToRenderer::SheetOffsets {
            sheet_id: shared_sheet_id,
            offsets_bytes,
        };

        // Serialize the message to bincode
        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        // Send to rust renderer via JS callback
        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }
}

#[wasm_bindgen]
impl GridController {
    /// Send complete sheet info (metadata + offsets) to the rust renderer.
    /// This should be called when:
    /// - A file is loaded with the rust renderer enabled
    /// - Switching to a different sheet
    /// - Sheet metadata changes (name, color, order)
    #[wasm_bindgen(js_name = "sendSheetInfoToRustRenderer")]
    pub fn js_send_sheet_info_to_rust_renderer(&self, sheet_id: String) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid sheet_id: {e}")))?;
        self.send_sheet_info_to_rust_renderer(sheet_id)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send sheet info for all sheets to the rust renderer.
    /// This should be called when a file is loaded with the rust renderer enabled.
    #[wasm_bindgen(js_name = "sendAllSheetInfoToRustRenderer")]
    pub fn js_send_all_sheet_info_to_rust_renderer(&self) -> Result<(), JsValue> {
        self.send_all_sheet_info_to_rust_renderer()
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send sheet offsets to the rust renderer.
    /// This should be called when column/row sizes change.
    #[wasm_bindgen(js_name = "sendSheetOffsetsToRustRenderer")]
    pub fn js_send_sheet_offsets_to_rust_renderer(&self, sheet_id: String) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid sheet_id: {e}")))?;
        self.send_sheet_offsets_to_rust_renderer(sheet_id)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Send all sheet offsets to the rust renderer (for all sheets).
    /// This should be called when a file is loaded with the rust renderer enabled.
    #[wasm_bindgen(js_name = "sendAllSheetOffsetsToRustRenderer")]
    pub fn js_send_all_sheet_offsets_to_rust_renderer(&self) -> Result<(), JsValue> {
        for sheet_id in self.sheet_ids() {
            self.send_sheet_offsets_to_rust_renderer(sheet_id)
                .map_err(|e| JsValue::from_str(&e))?;
        }
        Ok(())
    }
}
