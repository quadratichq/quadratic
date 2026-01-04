//! Functions for communicating with the Rust renderer.
//!
//! These functions handle bidirectional bincode communication between
//! the core worker and the rust renderer worker.
//!
//! This module uses the Rust-native rendering functions from `rendering_rust/`
//! which produce `RenderCell`, `RenderFill`, and `RenderCodeCell` directly,
//! eliminating conversion overhead.

use std::str::FromStr;

use super::*;
use crate::Rect;
use crate::grid::SheetId;
use crate::wasm_bindings::js::log;
use quadratic_core_shared::{
    CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH, CoreToRenderer, HashCells, RendererToCore, SheetInfo,
    serialization,
};

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

        // Get the sheet bounds (data + formatting) for limiting renderer hash requests
        let bounds = sheet.bounds(false);

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
            bounds,
        };

        // Create the message
        let message = CoreToRenderer::SheetInfo(sheet_info);

        // Serialize the message to bincode
        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        log(&format!(
            "[rust_renderer] Sending SheetInfo '{}' ({} bytes) to renderer, bounds: {:?}",
            sheet.name,
            bytes.len(),
            bounds
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

    // =========================================================================
    // Receiving messages from Rust Renderer
    // =========================================================================

    /// Handle a bincode-encoded message from the rust renderer.
    pub fn handle_rust_renderer_message(&self, data: &[u8]) -> Result<(), String> {
        let message: RendererToCore = serialization::deserialize(data)
            .map_err(|e| format!("Failed to deserialize renderer message: {e}"))?;

        log(&format!(
            "[rust_renderer] Received message: {:?}",
            std::mem::discriminant(&message)
        ));

        match message {
            RendererToCore::Ready => {
                log("[rust_renderer] Renderer ready, sending initial data");

                // Send all sheet info
                let _ = self.send_all_sheet_info_to_rust_renderer();

                // Send meta fills, code cells, and initial hashes for the first sheet
                if let Some(first_sheet_id) = self.sheet_ids().first().copied() {
                    // Send meta fills
                    if let Err(e) = self.send_meta_fills_to_rust_renderer_by_id(first_sheet_id) {
                        log(&format!("[rust_renderer] Error sending meta fills: {}", e));
                    }

                    // Send code cells (tables)
                    if let Err(e) = self.send_code_cells_to_rust_renderer(first_sheet_id) {
                        log(&format!("[rust_renderer] Error sending code cells: {}", e));
                    }

                    // Send initial hashes for a reasonable viewport (e.g., first 10x10 hashes)
                    let initial_hashes: Vec<quadratic_core_shared::Pos> = (0..10_i64)
                        .flat_map(|x| {
                            (0..10_i64).map(move |y| quadratic_core_shared::Pos::new(x, y))
                        })
                        .collect();

                    if let Err(e) =
                        self.send_hashes_to_rust_renderer(first_sheet_id, &initial_hashes)
                    {
                        log(&format!(
                            "[rust_renderer] Error sending initial hashes: {}",
                            e
                        ));
                    }
                }
            }

            RendererToCore::RequestMetaFills { sheet_id } => {
                let local_sheet_id = SheetId::from_str(&sheet_id.to_string())
                    .map_err(|e| format!("Invalid sheet_id: {e}"))?;

                log(&format!(
                    "[rust_renderer] Sending meta fills for sheet {}",
                    sheet_id
                ));

                self.send_meta_fills_to_rust_renderer_by_id(local_sheet_id)?;
            }

            RendererToCore::RequestHashes { sheet_id, hashes } => {
                let local_sheet_id = SheetId::from_str(&sheet_id.to_string())
                    .map_err(|e| format!("Invalid sheet_id: {e}"))?;

                log(&format!(
                    "[rust_renderer] Sending {} hashes for sheet {}",
                    hashes.len(),
                    sheet_id
                ));

                self.send_hashes_to_rust_renderer(local_sheet_id, &hashes)?;
            }

            RendererToCore::ViewportChanged {
                sheet_id,
                visible_rect: _,
                hash_bounds,
            } => {
                // Convert hash bounds to list of hash positions
                let mut hashes = Vec::new();
                for x in hash_bounds.min.x..=hash_bounds.max.x {
                    for y in hash_bounds.min.y..=hash_bounds.max.y {
                        hashes.push(quadratic_core_shared::Pos::new(x, y));
                    }
                }

                let local_sheet_id = SheetId::from_str(&sheet_id.to_string())
                    .map_err(|e| format!("Invalid sheet_id: {e}"))?;

                self.send_hashes_to_rust_renderer(local_sheet_id, &hashes)?;
            }

            // These are user interaction messages - forward to appropriate handlers
            RendererToCore::CellClick { .. }
            | RendererToCore::CellHover { .. }
            | RendererToCore::SelectionStart { .. }
            | RendererToCore::SelectionDrag { .. }
            | RendererToCore::SelectionEnd
            | RendererToCore::CellEdit { .. }
            | RendererToCore::ColumnResize { .. }
            | RendererToCore::RowResize { .. } => {
                // TODO: Forward to appropriate handlers when implemented
                log(&format!(
                    "[rust_renderer] Ignoring user interaction message: {:?}",
                    std::mem::discriminant(&message)
                ));
            }
        }

        Ok(())
    }

    /// Send meta fills for a sheet to the rust renderer.
    /// Uses Rust-native rendering functions directly - no conversion needed.
    fn send_meta_fills_to_rust_renderer_by_id(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Use Rust-native rendering function - returns SheetFill directly!
        let fills = sheet.get_rust_all_sheet_fills();

        let fills_bytes = serialization::serialize(&fills)
            .map_err(|e| format!("Failed to serialize fills: {e}"))?;

        let message = CoreToRenderer::SheetMetaFills {
            sheet_id: shared_sheet_id,
            fills_bytes,
        };

        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        log(&format!(
            "[rust_renderer] Sending {} meta fills ({} bytes)",
            fills.len(),
            bytes.len()
        ));

        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }

    /// Send code cells (tables) for a sheet to the rust renderer.
    /// Uses Rust-native rendering functions directly - no conversion needed.
    fn send_code_cells_to_rust_renderer(&self, sheet_id: SheetId) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        // Use Rust-native rendering function - returns RenderCodeCell directly!
        let code_cells = sheet.get_rust_all_render_code_cells();

        if code_cells.is_empty() {
            log(&format!(
                "[rust_renderer] No code cells to send for sheet {}",
                sheet_id
            ));
            return Ok(());
        }

        let message = CoreToRenderer::CodeCells {
            sheet_id: shared_sheet_id,
            code_cells: code_cells.clone(),
        };

        let bytes = serialization::serialize(&message)
            .map_err(|e| format!("Failed to serialize message: {e}"))?;

        log(&format!(
            "[rust_renderer] Sending {} code cells ({} bytes)",
            code_cells.len(),
            bytes.len()
        ));

        crate::wasm_bindings::js::jsSendToRustRenderer(bytes);

        Ok(())
    }

    /// Send code cells for all sheets to the rust renderer.
    /// This is called when the file is loaded.
    #[allow(dead_code)]
    pub fn send_all_code_cells_to_rust_renderer(&self) -> Result<(), String> {
        for sheet_id in self.sheet_ids() {
            self.send_code_cells_to_rust_renderer(sheet_id)?;
        }
        Ok(())
    }

    /// Send hash cells for specific hashes to the rust renderer.
    /// Uses Rust-native rendering functions that produce RenderCell/RenderFill directly,
    /// eliminating conversion overhead.
    fn send_hashes_to_rust_renderer(
        &self,
        sheet_id: SheetId,
        hashes: &[quadratic_core_shared::Pos],
    ) -> Result<(), String> {
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| "Sheet not found".to_string())?;

        let shared_sheet_id = quadratic_core_shared::SheetId::from_str(&sheet_id.to_string())
            .map_err(|e| format!("Invalid sheet_id: {e}"))?;

        let mut hash_cells_vec = Vec::new();
        let a1_context = self.a1_context();

        for hash in hashes {
            let rect = Rect::from_numbers(
                hash.x * CELL_SHEET_WIDTH as i64,
                hash.y * CELL_SHEET_HEIGHT as i64,
                CELL_SHEET_WIDTH as i64,
                CELL_SHEET_HEIGHT as i64,
            );

            // Use Rust-native rendering functions directly - no conversion needed!
            let fills = sheet.get_rust_render_fills_in_rect(rect);
            let cells = sheet.get_rust_render_cells(rect, &a1_context);

            hash_cells_vec.push(HashCells {
                sheet_id: shared_sheet_id.clone(),
                hash_pos: *hash,
                cells,
                fills,
            });
        }

        if !hash_cells_vec.is_empty() {
            let message = CoreToRenderer::HashCells(hash_cells_vec);
            let bytes = serialization::serialize(&message)
                .map_err(|e| format!("Failed to serialize message: {e}"))?;

            log(&format!(
                "[rust_renderer] Sending {} hash cells ({} bytes)",
                hashes.len(),
                bytes.len()
            ));

            crate::wasm_bindings::js::jsSendToRustRenderer(bytes);
        }

        Ok(())
    }

    // =========================================================================
    // Sending messages to Rust Renderer
    // =========================================================================

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
    /// Handle a bincode-encoded message from the rust renderer.
    /// This is called from TypeScript when a message arrives via MessagePort.
    #[wasm_bindgen(js_name = "handleRustRendererMessage")]
    pub fn js_handle_rust_renderer_message(&self, data: &[u8]) -> Result<(), JsValue> {
        self.handle_rust_renderer_message(data)
            .map_err(|e| JsValue::from_str(&e))
    }

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
