//! Unified Worker Renderer
//!
//! The main entry point for browser-based rendering in a web worker.
//! Supports both WebGPU (preferred) and WebGL2 (fallback) backends.
//!
//! # Usage
//!
//! ```javascript
//! // Check WebGPU availability and create renderer
//! if (WorkerRenderer.is_webgpu_available()) {
//!     const renderer = await WorkerRenderer.new_webgpu(canvas);
//! } else {
//!     const renderer = new WorkerRenderer(canvas);
//! }
//! ```

#[cfg(target_arch = "wasm32")]
use js_sys::SharedArrayBuffer;
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use web_sys::{HtmlImageElement, OffscreenCanvas};

#[cfg(target_arch = "wasm32")]
use crate::renderers::render_context::RenderContext;
#[cfg(target_arch = "wasm32")]
use crate::sheets::text::BitmapFont;
use crate::viewport::ViewportBuffer;

use super::RenderBackend;
#[cfg(target_arch = "wasm32")]
use super::js;
#[cfg(target_arch = "wasm32")]
use super::render;
use super::state::RendererState;

#[cfg(target_arch = "wasm32")]
use quadratic_core_shared::{RendererToCore, serialization};

/// Unified worker-based renderer for browser
///
/// This is the main entry point exposed to JavaScript.
/// It uses RenderBackend internally to support both WebGL and WebGPU.
#[wasm_bindgen]
pub struct WorkerRenderer {
    /// Render backend (WebGL or WebGPU)
    backend: RenderBackend,

    /// Shared renderer state
    state: RendererState,

    /// Optional shared viewport buffer (when viewport is controlled by main thread)
    shared_viewport: Option<ViewportBuffer>,
}

// ============================================================================
// Internal methods (not exposed to JavaScript)
// ============================================================================

#[cfg(target_arch = "wasm32")]
impl WorkerRenderer {
    /// Send a message to the core worker
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

    /// Request meta fills for the current sheet
    #[allow(dead_code)]
    pub fn request_meta_fills(&self, sheet_id: quadratic_core_shared::SheetId) {
        self.send_to_core(RendererToCore::RequestMetaFills { sheet_id });
    }

    /// Request hash cells for specific hashes
    pub fn request_hashes(
        &self,
        sheet_id: quadratic_core_shared::SheetId,
        hashes: Vec<quadratic_core_shared::Pos>,
    ) {
        if !hashes.is_empty() {
            self.send_to_core(RendererToCore::RequestHashes { sheet_id, hashes });
        }
    }
}

// ============================================================================
// JavaScript API (exposed via wasm_bindgen)
// ============================================================================

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl WorkerRenderer {
    // =========================================================================
    // Construction
    // =========================================================================

    /// Check if WebGPU is available in this browser
    #[wasm_bindgen]
    pub fn is_webgpu_available() -> bool {
        RenderBackend::is_webgpu_available()
    }

    /// Create a new WebGL renderer from a transferred OffscreenCanvas (sync)
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: OffscreenCanvas) -> Result<WorkerRenderer, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        let backend = RenderBackend::create_webgl(canvas)?;
        let state = RendererState::new(width as f32, height as f32);

        Ok(Self {
            backend,
            state,
            shared_viewport: None,
        })
    }

    /// Create a new WebGPU renderer from a transferred OffscreenCanvas (async)
    #[wasm_bindgen]
    pub async fn new_webgpu(canvas: OffscreenCanvas) -> Result<WorkerRenderer, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        let backend = RenderBackend::create_webgpu(canvas).await?;
        let state = RendererState::new(width as f32, height as f32);

        Ok(Self {
            backend,
            state,
            shared_viewport: None,
        })
    }

    /// Get the backend type name
    #[wasm_bindgen]
    pub fn backend_name(&self) -> String {
        match self.backend.backend_type() {
            super::BackendType::WebGL => "WebGL".to_string(),
            super::BackendType::WebGPU => "WebGPU".to_string(),
        }
    }

    // =========================================================================
    // Viewport Buffer
    // =========================================================================

    /// Set the viewport buffer (SharedArrayBuffer from main thread)
    ///
    /// When set, the renderer will read viewport state from this buffer
    /// instead of using the local viewport. This allows the main thread
    /// to control viewport position and zoom.
    #[wasm_bindgen]
    pub fn set_viewport_buffer(&mut self, buffer: SharedArrayBuffer) {
        let vb = ViewportBuffer::from_buffer(buffer);

        // Immediately update state viewport with buffer values
        self.state.set_viewport(vb.x(), vb.y(), vb.scale());
        self.state
            .resize_viewport(vb.width(), vb.height(), vb.dpr());

        // Resize the backend to match the correct canvas size
        self.backend.resize(vb.width() as u32, vb.height() as u32);

        // Mark dirty to ensure we render with correct values
        self.state.set_viewport_dirty();

        self.shared_viewport = Some(vb);
    }

    /// Check if using shared viewport
    #[wasm_bindgen]
    pub fn is_using_shared_viewport(&self) -> bool {
        self.shared_viewport.is_some()
    }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    /// Start the renderer
    #[wasm_bindgen]
    pub fn start(&mut self) {
        self.state.start();

        // Send Ready message to core to request initial data
        self.send_to_core(RendererToCore::Ready);
    }

    /// Stop the renderer
    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.state.stop();
    }

    /// Check if running
    #[wasm_bindgen]
    pub fn is_running(&self) -> bool {
        self.state.is_running()
    }

    /// Resize the renderer
    ///
    /// # Arguments
    /// * `width` - Width in device pixels
    /// * `height` - Height in device pixels
    /// * `dpr` - Device pixel ratio (e.g., 2.0 for Retina displays)
    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32, dpr: f32) {
        self.backend.resize(width, height);
        self.state.resize_viewport(width as f32, height as f32, dpr);
    }

    // =========================================================================
    // Viewport Getters
    // =========================================================================

    /// Get current scale
    #[wasm_bindgen]
    pub fn get_scale(&self) -> f32 {
        self.state.get_scale()
    }

    /// Get viewport X
    #[wasm_bindgen]
    pub fn get_x(&self) -> f32 {
        self.state.get_x()
    }

    /// Get viewport Y
    #[wasm_bindgen]
    pub fn get_y(&self) -> f32 {
        self.state.get_y()
    }

    // =========================================================================
    // Headings
    // =========================================================================

    /// Toggle headings visibility
    #[wasm_bindgen]
    pub fn set_show_headings(&mut self, show: bool) {
        self.state.set_show_headings(show);
    }

    /// Get headings visibility
    #[wasm_bindgen]
    pub fn get_show_headings(&self) -> bool {
        self.state.get_show_headings()
    }

    /// Get heading size (row header width in pixels)
    #[wasm_bindgen]
    pub fn get_heading_width(&self) -> f32 {
        self.state.get_heading_width()
    }

    /// Get heading size (column header height in pixels)
    #[wasm_bindgen]
    pub fn get_heading_height(&self) -> f32 {
        self.state.get_heading_height()
    }

    /// Set selected columns for heading highlight
    /// Takes flat array of [start1, end1, start2, end2, ...] pairs (1-indexed)
    #[wasm_bindgen]
    pub fn set_selected_columns(&mut self, selections: &[i32]) {
        self.state.set_selected_columns(selections);
    }

    /// Set selected rows for heading highlight
    /// Takes flat array of [start1, end1, start2, end2, ...] pairs (1-indexed)
    #[wasm_bindgen]
    pub fn set_selected_rows(&mut self, selections: &[i32]) {
        self.state.set_selected_rows(selections);
    }

    /// Set device pixel ratio for headings (affects font size)
    #[wasm_bindgen]
    pub fn set_headings_dpr(&mut self, dpr: f32) {
        self.state.set_headings_dpr(dpr);
    }

    // =========================================================================
    // Dirty Flags
    // =========================================================================

    /// Mark the viewport as dirty (forces a render next frame)
    #[wasm_bindgen]
    pub fn set_viewport_dirty(&mut self) {
        self.state.set_viewport_dirty();
    }

    /// Mark grid lines as dirty
    #[wasm_bindgen]
    pub fn set_grid_lines_dirty(&mut self) {
        self.state.set_grid_lines_dirty();
    }

    /// Mark cursor as dirty
    #[wasm_bindgen]
    pub fn set_cursor_dirty(&mut self) {
        self.state.set_cursor_dirty();
    }

    /// Mark headings as dirty
    #[wasm_bindgen]
    pub fn set_headings_dirty(&mut self) {
        self.state.set_headings_dirty();
    }

    /// Check if any component is dirty and needs rendering
    #[wasm_bindgen]
    pub fn is_dirty(&self) -> bool {
        self.state.is_dirty()
    }

    // =========================================================================
    // Debug
    // =========================================================================

    /// Set debug mode: show colored overlay on text hashes that were recalculated
    #[wasm_bindgen]
    pub fn set_debug_show_text_updates(&mut self, show: bool) {
        self.state.set_debug_show_text_updates(show);
    }

    /// Get debug mode for text updates
    #[wasm_bindgen]
    pub fn get_debug_show_text_updates(&self) -> bool {
        self.state.get_debug_show_text_updates()
    }

    // =========================================================================
    // Cursor
    // =========================================================================

    /// Set cursor position
    #[wasm_bindgen]
    pub fn set_cursor(&mut self, col: i64, row: i64) {
        self.state.set_cursor(col, row);
    }

    /// Set cursor selection range
    #[wasm_bindgen]
    pub fn set_cursor_selection(
        &mut self,
        start_col: i64,
        start_row: i64,
        end_col: i64,
        end_row: i64,
    ) {
        self.state
            .set_cursor_selection(start_col, start_row, end_col, end_row);
    }

    /// Set the A1Selection from bincode-encoded bytes.
    /// This is the primary way to sync selection state from the client.
    #[wasm_bindgen]
    pub fn set_a1_selection(&mut self, data: &[u8]) -> Result<(), JsValue> {
        use quadratic_core_shared::A1Selection;
        let (selection, _): (A1Selection, _) =
            bincode::decode_from_slice(data, bincode::config::standard())
                .map_err(|e| JsValue::from_str(&format!("Failed to decode A1Selection: {}", e)))?;
        self.state.set_a1_selection(selection);
        Ok(())
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    /// Upload a font texture from an HtmlImageElement (WebGL only)
    #[wasm_bindgen]
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        image: &HtmlImageElement,
    ) -> Result<(), JsValue> {
        match &mut self.backend {
            RenderBackend::WebGL(gl) => gl.upload_font_texture(texture_uid, image),
            RenderBackend::WebGPU(_) => Err(JsValue::from_str(
                "upload_font_texture not supported on WebGPU, use upload_font_texture_from_data",
            )),
        }
    }

    /// Upload a font texture from raw RGBA pixel data
    #[wasm_bindgen]
    pub fn upload_font_texture_from_data(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        self.backend
            .upload_font_texture_from_data(texture_uid, width, height, data)?;
        // Mark headings dirty so they render now that textures are available
        self.state.set_headings_dirty();
        Ok(())
    }

    /// Add a font from JSON data
    /// Expected format: { font: string, size: number, lineHeight: number, chars: { [charCode: string]: CharData } }
    #[wasm_bindgen]
    pub fn add_font(&mut self, font_json: &str) -> Result<(), JsValue> {
        let font: BitmapFont = serde_json::from_str(font_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse font JSON: {}", e)))?;
        self.state.add_font(font);
        Ok(())
    }

    /// Check if fonts are loaded
    #[wasm_bindgen]
    pub fn has_fonts(&self) -> bool {
        self.state.has_fonts()
    }

    // =========================================================================
    // Emoji Sprites (Lazy Loading)
    // =========================================================================

    /// Load emoji mapping from JSON string
    /// Expected format: { pageSize, characterSize, scaleEmoji, pages: [...], emojis: {...} }
    /// This only loads the mapping - textures are loaded lazily as needed.
    #[wasm_bindgen]
    pub fn load_emoji_mapping(&mut self, json: &str) -> Result<(), JsValue> {
        self.state
            .load_emoji_mapping(json)
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Check if emoji mapping is loaded
    #[wasm_bindgen]
    pub fn has_emoji_mapping(&self) -> bool {
        self.state.emoji_sprites.is_loaded()
    }

    /// Get the number of emoji spritesheet pages
    #[wasm_bindgen]
    pub fn emoji_page_count(&self) -> usize {
        self.state.emoji_sprites.page_count()
    }

    /// Get pages that need to be loaded (collected during layout)
    /// Returns a flat array of page indices
    #[wasm_bindgen]
    pub fn get_needed_emoji_pages(&self) -> Box<[u32]> {
        self.state
            .emoji_sprites
            .get_needed_pages()
            .iter()
            .map(|&p| p as u32)
            .collect::<Vec<_>>()
            .into_boxed_slice()
    }

    /// Check if there are emoji pages that need loading
    #[wasm_bindgen]
    pub fn has_needed_emoji_pages(&self) -> bool {
        self.state.emoji_sprites.has_needed_pages()
    }

    /// Get the URL for an emoji page
    #[wasm_bindgen]
    pub fn get_emoji_page_url(&self, page: usize) -> Option<String> {
        self.state.emoji_sprites.page_url(page)
    }

    /// Mark an emoji page as loading (called before fetch starts)
    #[wasm_bindgen]
    pub fn mark_emoji_page_loading(&mut self, page: usize) {
        self.state.emoji_sprites.mark_page_loading(page);
    }

    /// Upload an emoji spritesheet texture from raw RGBA pixel data
    /// and mark the page as loaded
    #[wasm_bindgen]
    pub fn upload_emoji_page(
        &mut self,
        page: usize,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        let texture_uid = self.state.emoji_sprites.texture_uid(page);

        // Upload the texture (reuse font texture mechanism)
        self.backend
            .upload_font_texture_from_data(texture_uid, width, height, data)?;

        // Mark page as loaded
        self.state.emoji_sprites.mark_page_loaded(page);

        // Mark viewport dirty to trigger re-render - no need to rebuild hashes
        // since emoji sprite data (texture UID, UVs) is already cached
        self.state.set_viewport_dirty();

        Ok(())
    }

    /// Mark an emoji page as failed to load
    #[wasm_bindgen]
    pub fn mark_emoji_page_failed(&mut self, page: usize) {
        self.state.emoji_sprites.mark_page_failed(page);
    }

    /// Check if an emoji page is loaded
    #[wasm_bindgen]
    pub fn is_emoji_page_loaded(&self, page: usize) -> bool {
        self.state.emoji_sprites.is_page_loaded(page)
    }

    // =========================================================================
    // Labels
    // =========================================================================

    /// Add a cell label (text content)
    /// col and row are 1-indexed cell coordinates
    #[wasm_bindgen]
    pub fn add_label(&mut self, text: &str, col: i64, row: i64) {
        self.state.add_label(text, col, row);
    }

    /// Add a styled cell label
    /// col and row are 1-indexed cell coordinates
    #[wasm_bindgen]
    pub fn add_styled_label(
        &mut self,
        text: &str,
        col: i64,
        row: i64,
        font_size: f32,
        bold: bool,
        italic: bool,
        color_r: f32,
        color_g: f32,
        color_b: f32,
        align: u8,
        valign: u8,
    ) {
        self.state.add_styled_label(
            text,
            col,
            row,
            Some(font_size),
            bold,
            italic,
            color_r,
            color_g,
            color_b,
            Some(align as i32),
            Some(valign as i32),
        );
    }

    /// Clear all labels
    #[wasm_bindgen]
    pub fn clear_labels(&mut self) {
        self.state.clear_labels();
    }

    /// Get total label count
    #[wasm_bindgen]
    pub fn get_label_count(&self) -> usize {
        self.state.get_label_count()
    }

    // =========================================================================
    // Lazy Loading API
    // =========================================================================

    /// Get visible hash bounds for the current viewport
    /// Returns: [min_hash_x, max_hash_x, min_hash_y, max_hash_y]
    #[wasm_bindgen]
    pub fn get_visible_hash_bounds(&self) -> Box<[i32]> {
        Box::new(self.state.get_visible_hash_bounds())
    }

    /// Get list of hashes that need to be loaded (visible but not yet loaded)
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    #[wasm_bindgen]
    pub fn get_needed_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_hashes().into_boxed_slice()
    }

    /// Get list of loaded hashes that are outside the visible bounds
    /// These can be unloaded to save memory
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    #[wasm_bindgen]
    pub fn get_offscreen_hashes(&self) -> Box<[i32]> {
        self.state.get_offscreen_hashes().into_boxed_slice()
    }

    /// Remove a hash (for memory management when hash goes offscreen)
    #[wasm_bindgen]
    pub fn remove_hash(&mut self, hash_x: i32, hash_y: i32) {
        self.state.remove_hash(hash_x, hash_y);
    }

    /// Check if a hash is loaded
    #[wasm_bindgen]
    pub fn has_hash(&self, hash_x: i32, hash_y: i32) -> bool {
        self.state.has_hash(hash_x, hash_y)
    }

    /// Get number of loaded hashes
    #[wasm_bindgen]
    pub fn get_hash_count(&self) -> usize {
        self.state.get_hash_count()
    }

    /// Get total sprite cache memory usage in bytes
    #[wasm_bindgen]
    pub fn get_sprite_memory_bytes(&self) -> usize {
        self.state.get_sprite_memory_bytes()
    }

    /// Get number of active sprite caches
    #[wasm_bindgen]
    pub fn get_sprite_count(&self) -> usize {
        self.state.get_sprite_count()
    }

    // =========================================================================
    // Fills (cell backgrounds)
    // =========================================================================

    /// Check if meta fills have been loaded
    #[wasm_bindgen]
    pub fn fills_meta_loaded(&self) -> bool {
        self.state.fills_meta_loaded()
    }

    /// Set fills for a specific hash
    /// fills_data: bincode-encoded Vec<RenderFill>
    #[wasm_bindgen]
    pub fn set_fills_for_hash(
        &mut self,
        hash_x: i32,
        hash_y: i32,
        fills_data: &[u8],
    ) -> Result<(), JsValue> {
        let (fills, _): (Vec<quadratic_core_shared::RenderFill>, _) =
            bincode::decode_from_slice(fills_data, bincode::config::standard())
                .map_err(|e| JsValue::from_str(&format!("Failed to decode fills: {}", e)))?;
        self.state
            .set_fills_for_hash(hash_x as i64, hash_y as i64, fills);
        Ok(())
    }

    /// Set meta fills (infinite row/column/sheet fills)
    /// fills_data: bincode-encoded Vec<SheetFill>
    #[wasm_bindgen]
    pub fn set_meta_fills(&mut self, fills_data: &[u8]) -> Result<(), JsValue> {
        let (fills, _): (Vec<quadratic_core_shared::SheetFill>, _) =
            bincode::decode_from_slice(fills_data, bincode::config::standard())
                .map_err(|e| JsValue::from_str(&format!("Failed to decode meta fills: {}", e)))?;
        self.state.set_meta_fills(fills);
        Ok(())
    }

    /// Mark a fills hash as dirty (needs reload when visible)
    #[wasm_bindgen]
    pub fn mark_fills_hash_dirty(&mut self, hash_x: i32, hash_y: i32) {
        self.state
            .mark_fills_hash_dirty(hash_x as i64, hash_y as i64);
    }

    /// Get fill hashes that need to be loaded (visible but not yet loaded)
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    #[wasm_bindgen]
    pub fn get_needed_fill_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_fill_hashes().into_boxed_slice()
    }

    /// Get fill hashes that can be unloaded (outside viewport)
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    #[wasm_bindgen]
    pub fn get_offscreen_fill_hashes(&self) -> Box<[i32]> {
        self.state.get_offscreen_fill_hashes().into_boxed_slice()
    }

    /// Unload a fill hash to free memory
    #[wasm_bindgen]
    pub fn unload_fill_hash(&mut self, hash_x: i32, hash_y: i32) {
        self.state.unload_fill_hash(hash_x as i64, hash_y as i64);
    }

    /// Check if a fill hash is loaded
    #[wasm_bindgen]
    pub fn has_fill_hash(&self, hash_x: i32, hash_y: i32) -> bool {
        self.state.has_fill_hash(hash_x as i64, hash_y as i64)
    }

    /// Get number of loaded fill hashes
    #[wasm_bindgen]
    pub fn get_fill_hash_count(&self) -> usize {
        self.state.get_fill_hash_count()
    }

    /// Get total fill count
    #[wasm_bindgen]
    pub fn get_fill_count(&self) -> usize {
        self.state.get_fill_count()
    }

    /// Add test fills for development/debugging
    #[wasm_bindgen]
    pub fn add_test_fills(&mut self) {
        self.state.add_test_fills();
    }

    // =========================================================================
    // Cell Labels (text content)
    // =========================================================================

    /// Add multiple labels for a hash in batch (parallelized)
    #[wasm_bindgen]
    pub fn add_labels_batch(
        &mut self,
        hash_x: i32,
        hash_y: i32,
        texts: Vec<String>,
        cols: &[i32],
        rows: &[i32],
        colors: Option<Vec<u8>>,
    ) {
        self.state
            .add_labels_batch(hash_x as i64, hash_y as i64, texts, cols, rows, colors);
    }

    /// Set cell labels for a specific hash
    /// labels_data: bincode-encoded Vec<RenderCell>
    #[wasm_bindgen]
    pub fn set_labels_for_hash(
        &mut self,
        hash_x: i32,
        hash_y: i32,
        labels_data: &[u8],
    ) -> Result<(), JsValue> {
        let (cells, _): (Vec<quadratic_core_shared::RenderCell>, _) =
            bincode::decode_from_slice(labels_data, bincode::config::standard())
                .map_err(|e| JsValue::from_str(&format!("Failed to decode labels: {}", e)))?;
        self.state
            .set_labels_for_hash(hash_x as i64, hash_y as i64, cells);
        Ok(())
    }

    /// Mark a labels hash as dirty (needs reload when visible)
    #[wasm_bindgen]
    pub fn mark_labels_hash_dirty(&mut self, hash_x: i32, hash_y: i32) {
        self.state
            .mark_labels_hash_dirty(hash_x as i64, hash_y as i64);
    }

    /// Get label hashes that need to be loaded (visible but not yet loaded)
    #[wasm_bindgen]
    pub fn get_needed_label_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_label_hashes().into_boxed_slice()
    }

    /// Get label hashes that can be unloaded (outside viewport)
    #[wasm_bindgen]
    pub fn get_offscreen_label_hashes(&self) -> Box<[i32]> {
        self.state.get_offscreen_label_hashes().into_boxed_slice()
    }

    /// Unload a label hash to free memory
    #[wasm_bindgen]
    pub fn unload_label_hash(&mut self, hash_x: i32, hash_y: i32) {
        self.state.unload_label_hash(hash_x as i64, hash_y as i64);
    }

    /// Check if a label hash is loaded
    #[wasm_bindgen]
    pub fn has_label_hash(&self, hash_x: i32, hash_y: i32) -> bool {
        self.state.has_label_hash(hash_x as i64, hash_y as i64)
    }

    /// Get number of loaded label hashes
    #[wasm_bindgen]
    pub fn get_label_hash_count(&self) -> usize {
        self.state.get_label_hash_count()
    }

    /// Add test labels for development/debugging
    #[wasm_bindgen]
    pub fn add_test_labels(&mut self) {
        self.state.add_test_labels();
    }

    // =========================================================================
    // Auto-size (column width / row height)
    // =========================================================================

    /// Get max content width for a column (for auto-resize)
    #[wasm_bindgen]
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.state.get_column_max_width(column)
    }

    /// Get max content height for a row (for auto-resize)
    #[wasm_bindgen]
    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.state.get_row_max_height(row)
    }

    // =========================================================================
    // Frame Rendering
    // =========================================================================

    /// Render a single frame
    /// elapsed: Time since last frame in milliseconds (for deceleration)
    /// Returns true if a render actually occurred, false if nothing was dirty
    #[wasm_bindgen]
    pub fn frame(&mut self, elapsed: f32) -> bool {
        if !self.state.is_running() {
            return false;
        }

        // Don't render until viewport buffer is set
        if self.shared_viewport.is_none() {
            return false;
        }

        // Sync from shared viewport buffer
        let viewport_changed = if let Some(ref mut shared) = self.shared_viewport {
            let changed = shared.sync();
            if changed {
                self.state
                    .set_viewport(shared.x(), shared.y(), shared.scale());
                self.state
                    .resize_viewport(shared.width(), shared.height(), shared.dpr());
                // Also resize backend if dimensions changed
                self.backend
                    .resize(shared.width() as u32, shared.height() as u32);
            }
            changed
        } else {
            false
        };

        // Check for needed hashes and request them from core
        if viewport_changed {
            if let Some(sheet_id) = self.state.current_sheet_id() {
                let needed = self.state.get_unrequested_hashes();
                if !needed.is_empty() {
                    self.request_hashes(sheet_id, needed);
                }
            }
        }

        // Update UI content based on viewport (grid lines, cursor, headings)
        self.state.update_content();

        // Check if we need to render:
        // - New data from layout worker
        // - State is dirty (viewport changed, etc.)
        // - We have cached hash data to render
        let has_new_batch_data = self.state.batch_cache.has_new_data();
        let has_cached_data = self.state.batch_cache.has_hashes();
        let needs_render = self.state.is_dirty() || has_new_batch_data || (viewport_changed && has_cached_data);

        if !needs_render {
            return false;
        }

        // Dispatch to backend-specific rendering
        // Pass None for batch - rendering now uses the persistent cache
        let is_webgl = matches!(&self.backend, RenderBackend::WebGL(_));
        let rendered = if is_webgl {
            self.frame_webgl_with_batch(elapsed, None)
        } else {
            self.frame_webgpu_with_batch(elapsed, None)
        };

        if rendered {
            // Mark everything as clean after rendering
            self.state.mark_clean();
            self.state.batch_cache.mark_rendered();

            // Clear the shared viewport buffer dirty flag
            if let Some(ref mut shared) = self.shared_viewport {
                shared.mark_clean();
            }
        }

        rendered
    }

    // =========================================================================
    // Core Message Handling
    // =========================================================================

    /// Handle a bincode-encoded message from core.
    #[wasm_bindgen]
    pub fn handle_core_message(&mut self, data: &[u8]) {
        if let Err(e) = super::message_handler::handle_core_message(&mut self.state, data) {
            log::error!("[WorkerRenderer] Error handling core message: {}", e);
        }
    }

    // =========================================================================
    // Layout Batch Handling (from Layout Worker)
    // =========================================================================

    /// Handle a bincode-encoded RenderBatch from the layout worker.
    /// This is the main data path for pre-computed geometry.
    #[wasm_bindgen]
    pub fn handle_layout_batch(&mut self, data: &[u8]) {
        match super::batch_receiver::decode_render_batch(data) {
            Ok(batch) => {
                self.state.batch_cache.update(batch);
            }
            Err(e) => {
                log::error!("[WorkerRenderer] Error decoding layout batch: {}", e);
            }
        }
    }

    /// Check if a new layout batch is available for rendering.
    #[wasm_bindgen]
    pub fn has_layout_batch(&self) -> bool {
        self.state.batch_cache.has_batch()
    }

    /// Get layout batch stats (batches_received, batches_rendered).
    #[wasm_bindgen]
    pub fn get_batch_stats(&self) -> Vec<u64> {
        vec![
            self.state.batch_cache.batches_received,
            self.state.batch_cache.batches_rendered,
        ]
    }
}

// =========================================================================
// Backend-specific frame rendering (private impl)
// =========================================================================

#[cfg(target_arch = "wasm32")]
impl WorkerRenderer {
    /// Check if fonts are fully ready (metadata loaded AND all textures uploaded)
    fn fonts_ready(&self) -> bool {
        if !self.state.has_fonts() {
            return false;
        }
        for uid in self.state.get_required_texture_uids() {
            if !self.backend.has_font_texture(uid) {
                return false;
            }
        }
        true
    }

    /// Render a frame using WebGL with cached batch data
    fn frame_webgl_with_batch(
        &mut self,
        _elapsed: f32,
        _batch: Option<quadratic_rust_renderer_shared::RenderBatch>,
    ) -> bool {
        // Pre-extract all values we need before borrowing backend
        let fonts_ready = self.fonts_ready();
        let (heading_width, heading_height) = self.state.get_heading_dimensions();
        let matrix = self
            .state
            .viewport
            .view_projection_matrix_with_offset(heading_width, heading_height);
        let matrix_array: [f32; 16] = matrix.to_cols_array();
        let canvas_width = self.state.viewport.width();
        let canvas_height = self.state.viewport.height();
        let content_x = heading_width as i32;
        let content_y = heading_height as i32;
        let content_width = (canvas_width as i32) - content_x;
        let content_height = (canvas_height as i32) - content_y;
        let offsets = self.state.get_sheet_offsets().clone();
        let (atlas_font_size, distance_range) = self.state.get_text_params();
        let viewport_scale = self.state.viewport.effective_scale();
        let show_headings = self.state.show_headings;
        let _debug_show_text_updates = self.state.debug_show_text_updates;
        let _scale = self.state.viewport.scale();
        let screen_matrix = self
            .state
            .create_screen_space_matrix(canvas_width, canvas_height);
        let (heading_atlas_font_size, heading_distance_range) =
            self.state.get_heading_text_params();

        // Background vertices
        let bg_vertices = render::get_background_vertices(&self.state.viewport);

        // Pre-extract cached hash data for text rendering
        let cached_hashes = self.state.batch_cache.get_hashes_vec();

        // Now borrow backend
        let gl = match &mut self.backend {
            RenderBackend::WebGL(gl) => gl,
            _ => return false,
        };

        // Begin frame
        gl.begin_frame();

        // Clear with out-of-bounds background color
        let oob_gray = 253.0 / 255.0;
        gl.clear(oob_gray, oob_gray, oob_gray, 1.0);

        // Set viewport to content area (after headings)
        gl.set_viewport(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );
        gl.set_scissor(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );

        // 1. Background
        if let Some(_vertices) = bg_vertices {
            let mut rects = crate::renderers::primitives::Rects::new();
            // The vertices contain position and color, but we just need a simple white rect
            let bounds = self.state.viewport.visible_bounds();
            let x = bounds.left.max(0.0);
            let y = bounds.top.max(0.0);
            let width = bounds.right - x;
            let height = bounds.bottom - y;
            rects.add(x, y, width, height, [1.0, 1.0, 1.0, 1.0]);
            rects.render(gl, &matrix_array);
        }

        // 2. Cell fills
        if let Some(sheet) = self.state.sheets.current_sheet_mut() {
            sheet
                .fills
                .render(gl, &matrix_array, &self.state.viewport, &offsets);
        }

        // 3. Grid lines
        self.state.ui.grid_lines.render(gl, &matrix_array);

        // 4. Cell text - render from cached hash data
        if fonts_ready && !cached_hashes.is_empty() {
            render::render_text_from_cache(
                gl,
                &cached_hashes,
                &matrix_array,
                viewport_scale,
                atlas_font_size,
                distance_range,
            );
        }

        // 5. Table headers (backgrounds and text) - rendered ON TOP of cell text
        if fonts_ready {
            if let Some(sheet) = self.state.sheets.current_sheet_mut() {
                render::render_table_headers(
                    gl,
                    sheet,
                    &self.state.viewport,
                    &offsets,
                    &self.state.fonts,
                    &matrix_array,
                    viewport_scale,
                    atlas_font_size,
                    distance_range,
                    heading_width,
                    heading_height,
                    self.state.viewport.dpr,
                );
            }
        }

        // 7. Cursor
        self.state
            .ui
            .cursor
            .render(gl, &matrix_array, viewport_scale);

        // Reset viewport for headings
        gl.reset_viewport();
        gl.disable_scissor();

        // 8. Headings (screen space)
        if show_headings && fonts_ready {
            self.state.ui.headings.layout(&self.state.fonts);
            self.state.ui.headings.render(
                gl,
                &screen_matrix,
                &self.state.fonts,
                heading_atlas_font_size,
                heading_distance_range,
                &offsets,
            );
        }

        // Execute all buffered draw commands
        gl.end_frame();

        true
    }

    /// Render a frame using WebGPU with optional pre-computed batch
    fn frame_webgpu_with_batch(
        &mut self,
        _elapsed: f32,
        _batch: Option<quadratic_rust_renderer_shared::RenderBatch>,
    ) -> bool {
        // Pre-extract all values we need before complex borrows
        let fonts_ready = self.fonts_ready();
        let (heading_width, heading_height) = self.state.get_heading_dimensions();
        let matrix = self
            .state
            .viewport
            .view_projection_matrix_with_offset(heading_width, heading_height);
        let matrix_array: [f32; 16] = matrix.to_cols_array();
        let canvas_width = self.state.viewport.width();
        let canvas_height = self.state.viewport.height();
        let content_x = heading_width as u32;
        let content_y = heading_height as u32;
        let content_width = (canvas_width as u32).saturating_sub(content_x);
        let content_height = (canvas_height as u32).saturating_sub(content_y);
        let scale = self.state.viewport.scale();
        let effective_scale = self.state.viewport.effective_scale();
        let (atlas_font_size, distance_range) = self.state.get_text_params();
        let show_headings = self.state.show_headings;
        let offsets = self.state.get_sheet_offsets().clone();
        let screen_matrix = self
            .state
            .create_screen_space_matrix(canvas_width, canvas_height);
        let (heading_atlas_font_size, heading_distance_range) =
            self.state.get_heading_text_params();

        // Pre-extract background vertices
        let bg_vertices = render::get_background_vertices(&self.state.viewport);

        // Pre-extract fill vertices (mutable access needed to rebuild caches)
        let (meta_fill_vertices, hash_fill_vertices) =
            if let Some(sheet) = self.state.sheets.current_sheet_mut() {
                render::get_fill_vertices(sheet, &self.state.viewport)
            } else {
                (None, Vec::new())
            };

        // Pre-extract table vertices (backgrounds and text meshes)
        let (table_name_bg, table_col_bg, table_outlines, table_header_lines, table_text_meshes) = if fonts_ready {
            if let Some(sheet) = self.state.sheets.current_sheet_mut() {
                render::get_table_vertices_for_webgpu(
                    sheet,
                    &self.state.viewport,
                    &offsets,
                    &self.state.fonts,
                    heading_width,
                    heading_height,
                    self.state.viewport.dpr,
                )
            } else {
                (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new())
            }
        } else {
            (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new())
        };

        // Pre-extract grid line vertices
        let grid_line_vertices = self.state.ui.grid_lines.get_vertices().map(|v| v.to_vec());

        // Pre-extract cursor vertices
        let cursor_fill_vertices = self.state.ui.cursor.get_fill_vertices().map(|v| v.to_vec());
        let cursor_border_vertices = self
            .state
            .ui
            .cursor
            .get_border_vertices(effective_scale)
            .map(|v| v.to_vec());

        // Pre-extract viewport bounds for text culling
        let bounds = self.state.viewport.visible_bounds();
        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.left + bounds.width + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.top + bounds.height + padding;

        // Check if we need sprite rendering (zoomed out)
        use crate::sheets::text::SPRITE_SCALE_THRESHOLD;
        let use_sprites = scale < SPRITE_SCALE_THRESHOLD;

        // Pre-extract cached hash data for text rendering
        let cached_hashes = self.state.batch_cache.get_hashes_vec();

        // Now borrow backend
        let gpu = match &mut self.backend {
            RenderBackend::WebGPU(gpu) => gpu,
            _ => return false,
        };

        // Note: Sprite caching and geometry computation is now handled by Layout Worker.
        // The batch contains pre-computed text geometry ready for GPU upload.
        // TODO: Implement batch-based rendering for WebGPU (similar to WebGL)

        // Get surface texture
        let output = match gpu.get_current_texture() {
            Ok(t) => t,
            Err(e) => {
                log::error!("Failed to get surface texture: {:?}", e);
                return false;
            }
        };

        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = gpu
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        // Clear with out-of-bounds background color
        let oob_gray = 253.0 / 255.0;

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: oob_gray as f64,
                            g: oob_gray as f64,
                            b: oob_gray as f64,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Set viewport to content area
            if content_width > 0 && content_height > 0 {
                pass.set_viewport(
                    content_x as f32,
                    content_y as f32,
                    content_width as f32,
                    content_height as f32,
                    0.0,
                    1.0,
                );
            }

            // 1. Background
            if let Some(ref vertices) = bg_vertices {
                gpu.draw_triangles(&mut pass, vertices, &matrix_array);
            }

            // 2. Fills
            if let Some(ref vertices) = meta_fill_vertices {
                gpu.draw_triangles(&mut pass, vertices, &matrix_array);
            }
            for vertices in &hash_fill_vertices {
                gpu.draw_triangles(&mut pass, vertices, &matrix_array);
            }

            // 3. Grid lines
            if let Some(ref line_vertices) = grid_line_vertices {
                gpu.draw_lines(&mut pass, line_vertices, &matrix_array);
            }

            // 4. Text - render from cached hash data
            if fonts_ready && !cached_hashes.is_empty() {
                render::render_text_from_cache_webgpu(
                    gpu,
                    &mut pass,
                    &cached_hashes,
                    &matrix_array,
                    effective_scale,
                    atlas_font_size,
                    distance_range,
                );
            }
            // Silence unused variable warnings for removed code paths
            let _ = (min_x, max_x, min_y, max_y, scale, use_sprites);

            // 5. Table headers (backgrounds and text) - rendered ON TOP of cell text
            if !table_name_bg.is_empty() {
                gpu.draw_triangles(&mut pass, &table_name_bg, &matrix_array);
            }
            if !table_col_bg.is_empty() {
                gpu.draw_triangles(&mut pass, &table_col_bg, &matrix_array);
            }
            if !table_outlines.is_empty() {
                gpu.draw_lines(&mut pass, &table_outlines, &matrix_array);
            }
            if !table_header_lines.is_empty() {
                gpu.draw_lines(&mut pass, &table_header_lines, &matrix_array);
            }
            for mesh in &table_text_meshes {
                if mesh.is_empty() {
                    continue;
                }
                let font_scale = mesh.font_size / atlas_font_size;
                let indices_u32: Vec<u32> =
                    mesh.get_index_data().iter().map(|&i| i as u32).collect();
                gpu.draw_text(
                    &mut pass,
                    &mesh.get_vertex_data(),
                    &indices_u32,
                    mesh.texture_uid,
                    &matrix_array,
                    effective_scale,
                    font_scale,
                    distance_range,
                );
            }

            // 7. Cursor
            if let Some(ref fill_vertices) = cursor_fill_vertices {
                gpu.draw_triangles(&mut pass, fill_vertices, &matrix_array);
            }
            if let Some(ref border_vertices) = cursor_border_vertices {
                gpu.draw_triangles(&mut pass, border_vertices, &matrix_array);
            }
        }

        // 8. Headings in a second pass (screen space)
        if show_headings && fonts_ready {
            self.state.ui.headings.layout(&self.state.fonts);
            let debug_label_bounds = self.state.ui.headings.debug_label_bounds;

            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Headings Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            let tex_width = output.texture.width();
            let tex_height = output.texture.height();
            pass.set_viewport(0.0, 0.0, tex_width as f32, tex_height as f32, 0.0, 1.0);
            pass.set_scissor_rect(0, 0, tex_width, tex_height);

            render::render_headings_webgpu(
                gpu,
                &mut pass,
                &mut self.state.ui.headings,
                &self.state.fonts,
                &screen_matrix,
                heading_atlas_font_size,
                heading_distance_range,
                &offsets,
                scale,
                debug_label_bounds,
            );
        }

        // Submit
        gpu.queue().submit(std::iter::once(encoder.finish()));
        output.present();

        true
    }

    /// Render emoji sprites for a hash using WebGPU
    fn render_emoji_sprites_webgpu(
        gpu: &mut crate::renderers::WebGPUContext,
        pass: &mut wgpu::RenderPass<'_>,
        hash: &crate::sheets::text::CellsTextHash,
        matrix: &[f32; 16],
    ) {
        let emoji_sprites = hash.get_emoji_sprites();
        if emoji_sprites.is_empty() {
            return;
        }

        // Render each texture group
        for (&texture_uid, sprites) in emoji_sprites {
            if sprites.is_empty() {
                continue;
            }

            // Build vertex data for all sprites in this group
            let mut vertices: Vec<f32> = Vec::with_capacity(sprites.len() * 32);
            let mut indices: Vec<u32> = Vec::with_capacity(sprites.len() * 6);

            for (i, sprite) in sprites.iter().enumerate() {
                // sprite.x and sprite.y are CENTER positions (matching TypeScript's anchor=0.5)
                // Convert to corner positions for rendering
                let half_w = sprite.width / 2.0;
                let half_h = sprite.height / 2.0;
                let x = sprite.x - half_w;
                let y = sprite.y - half_h;
                let x2 = sprite.x + half_w;
                let y2 = sprite.y + half_h;
                let u1 = sprite.uvs[0];
                let v1 = sprite.uvs[1];
                let u2 = sprite.uvs[2];
                let v2 = sprite.uvs[3];

                let base_index = (i * 4) as u32;

                // Top-left, top-right, bottom-right, bottom-left
                // Format: x, y, u, v, r, g, b, a
                vertices.extend_from_slice(&[
                    x, y, u1, v1, 1.0, 1.0, 1.0, 1.0, // Top-left
                    x2, y, u2, v1, 1.0, 1.0, 1.0, 1.0, // Top-right
                    x2, y2, u2, v2, 1.0, 1.0, 1.0, 1.0, // Bottom-right
                    x, y2, u1, v2, 1.0, 1.0, 1.0, 1.0, // Bottom-left
                ]);

                indices.extend_from_slice(&[
                    base_index,
                    base_index + 1,
                    base_index + 2,
                    base_index,
                    base_index + 2,
                    base_index + 3,
                ]);
            }

            // Draw the emoji sprites
            gpu.draw_emoji_sprites(pass, texture_uid, &vertices, &indices, matrix);
        }
    }
}
