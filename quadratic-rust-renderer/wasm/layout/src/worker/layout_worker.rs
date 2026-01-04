//! Layout Worker - main entry point

use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use js_sys::SharedArrayBuffer;

use quadratic_core_shared::ViewportBuffer;

#[cfg(target_arch = "wasm32")]
use quadratic_core_shared::{RendererToCore, serialization};

use super::state::LayoutState;
#[cfg(target_arch = "wasm32")]
use super::{js, message_handler};

/// Layout Worker - handles text layout and vertex buffer generation
#[wasm_bindgen]
pub struct LayoutWorker {
    state: LayoutState,
    shared_viewport: Option<ViewportBuffer>,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl LayoutWorker {
    // =========================================================================
    // Construction
    // =========================================================================

    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            state: LayoutState::new(),
            shared_viewport: None,
        }
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    #[wasm_bindgen]
    pub fn start(&mut self) {
        log::info!(
            "[LayoutWorker] Starting. has_fonts: {}",
            self.state.has_fonts()
        );
        self.state.start();
        // Send Ready message to core
        self.send_to_core(RendererToCore::Ready);
    }

    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.state.stop();
    }

    #[wasm_bindgen]
    pub fn is_running(&self) -> bool {
        self.state.is_running()
    }

    // =========================================================================
    // Viewport Buffer
    // =========================================================================

    #[wasm_bindgen]
    pub fn set_viewport_buffer(&mut self, buffer: SharedArrayBuffer) {
        let vb = ViewportBuffer::from_buffer(buffer);

        self.state.set_viewport(vb.x(), vb.y(), vb.scale());
        self.state.resize_viewport(vb.width(), vb.height(), vb.dpr());

        self.shared_viewport = Some(vb);
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    #[wasm_bindgen]
    pub fn add_font(&mut self, font_json: &str) -> Result<(), JsValue> {
        let font: crate::sheets::text::BitmapFont = serde_json::from_str(font_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse font JSON: {}", e)))?;
        log::info!("[LayoutWorker] Adding font: {}", font.name());
        self.state.add_font(font);
        log::info!(
            "[LayoutWorker] has_fonts: {}",
            self.state.has_fonts()
        );
        Ok(())
    }

    #[wasm_bindgen]
    pub fn has_fonts(&self) -> bool {
        self.state.has_fonts()
    }

    // =========================================================================
    // Selection
    // =========================================================================

    #[wasm_bindgen]
    pub fn set_a1_selection(&mut self, data: &[u8]) -> Result<(), JsValue> {
        use quadratic_core_shared::A1Selection;
        let selection: A1Selection = serialization::deserialize(data)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode A1Selection: {}", e)))?;
        self.state.ui.cursor.set_a1_selection(selection);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn set_cursor(&mut self, col: i64, row: i64) {
        self.state.ui.cursor.set_selected_cell(col, row);
    }

    #[wasm_bindgen]
    pub fn set_cursor_selection(&mut self, start_col: i64, start_row: i64, end_col: i64, end_row: i64) {
        self.state.ui.cursor.set_selection(start_col, start_row, end_col, end_row);
    }

    // =========================================================================
    // Headings
    // =========================================================================

    #[wasm_bindgen]
    pub fn set_show_headings(&mut self, show: bool) {
        self.state.show_headings = show;
        self.state.ui.headings.set_visible(show);
    }

    #[wasm_bindgen]
    pub fn get_heading_width(&self) -> f32 {
        self.state.get_heading_dimensions().0
    }

    #[wasm_bindgen]
    pub fn get_heading_height(&self) -> f32 {
        self.state.get_heading_dimensions().1
    }

    // =========================================================================
    // Core Message Handling
    // =========================================================================

    #[wasm_bindgen]
    pub fn handle_core_message(&mut self, data: &[u8]) {
        if let Err(e) = message_handler::handle_core_message(&mut self.state, data) {
            log::error!("[LayoutWorker] Error handling core message: {}", e);
        }
    }

    // =========================================================================
    // Main Update Loop
    // =========================================================================

    /// Sync viewport from shared buffer and check for needed data.
    /// Returns true if viewport changed.
    #[wasm_bindgen]
    pub fn sync_viewport(&mut self) -> bool {
        if let Some(ref mut shared) = self.shared_viewport {
            let changed = shared.sync();
            if changed {
                self.state.set_viewport(shared.x(), shared.y(), shared.scale());
                self.state.resize_viewport(shared.width(), shared.height(), shared.dpr());
                // Update current sheet if it changed
                if let Some(sheet_id) = shared.sheet_id() {
                    self.state.set_current_sheet(sheet_id);
                }
            }
            changed
        } else {
            false
        }
    }

    /// Request any needed hashes from core
    #[wasm_bindgen]
    pub fn request_needed_hashes(&mut self) {
        if let Some(sheet_id) = self.state.current_sheet_id() {
            let needed = self.state.get_unrequested_hashes();
            if !needed.is_empty() {
                self.send_to_core(RendererToCore::RequestHashes {
                    sheet_id,
                    hashes: needed,
                });
            }
        }
    }

    /// Generate render batch and return as bytes.
    /// Returns None if not ready (no fonts, not running) or nothing has changed.
    #[wasm_bindgen]
    pub fn update(&mut self) -> Option<Box<[u8]>> {
        if !self.state.is_running() {
            log::trace!("[LayoutWorker] update: not running");
            return None;
        }
        if !self.state.has_fonts() {
            log::trace!("[LayoutWorker] update: no fonts");
            return None;
        }

        // Only returns Some if there's dirty content to send
        let batch = self.state.generate_render_batch()?;

        // Log batch info
        log::debug!(
            "[LayoutWorker] Sending batch #{}: {} hashes",
            batch.sequence,
            batch.hashes.len(),
        );

        // Serialize to bincode
        match bincode::encode_to_vec(&batch, bincode::config::standard()) {
            Ok(bytes) => Some(bytes.into_boxed_slice()),
            Err(e) => {
                log::error!("[LayoutWorker] Failed to serialize render batch: {}", e);
                None
            }
        }
    }

    // =========================================================================
    // Queries
    // =========================================================================

    #[wasm_bindgen]
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.state.get_column_max_width(column)
    }

    #[wasm_bindgen]
    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.state.get_row_max_height(row)
    }

    // =========================================================================
    // Internal
    // =========================================================================

    fn send_to_core(&self, message: RendererToCore) {
        match serialization::serialize(&message) {
            Ok(bytes) => {
                js::js_send_to_core(bytes);
            }
            Err(e) => {
                log::error!("Failed to serialize message to core: {}", e);
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
impl Default for LayoutWorker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Default for LayoutWorker {
    fn default() -> Self {
        Self {
            state: LayoutState::new(),
            shared_viewport: None,
        }
    }
}
