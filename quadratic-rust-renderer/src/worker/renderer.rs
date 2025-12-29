//! Worker Renderer
//!
//! The main entry point for browser-based rendering in a web worker.
//! Receives an OffscreenCanvas and handles all rendering.

use js_sys::SharedArrayBuffer;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlImageElement, OffscreenCanvas};

use crate::render_context::RenderContext;
use crate::text::BitmapFont;
use crate::viewport::ViewportBuffer;
use crate::webgl::WebGLContext;

use super::state::RendererState;

/// Worker-based renderer for browser
///
/// This is the main entry point exposed to JavaScript.
/// It owns the context and handles all rendering.
#[wasm_bindgen]
pub struct WorkerRenderer {
    /// WebGL rendering context
    gl: WebGLContext,

    /// Shared renderer state
    state: RendererState,

    /// Optional shared viewport buffer (when viewport is controlled by main thread)
    shared_viewport: Option<ViewportBuffer>,
}

#[wasm_bindgen]
impl WorkerRenderer {
    /// Create a new renderer from a transferred OffscreenCanvas
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: OffscreenCanvas) -> Result<WorkerRenderer, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        log::info!("Creating WorkerRenderer ({}x{})", width, height);
        let gl = WebGLContext::from_offscreen_canvas(canvas)?;
        let state = RendererState::new(width as f32, height as f32);

        Ok(Self {
            gl,
            state,
            shared_viewport: None,
        })
    }

    /// Set the viewport buffer (SharedArrayBuffer from main thread)
    ///
    /// When set, the renderer will read viewport state from this buffer
    /// instead of using the local viewport. This allows the main thread
    /// to control viewport position and zoom.
    #[wasm_bindgen]
    pub fn set_viewport_buffer(&mut self, buffer: SharedArrayBuffer) {
        log::info!("Setting shared viewport buffer");
        self.shared_viewport = Some(ViewportBuffer::from_buffer(buffer));
    }

    /// Check if using shared viewport
    #[wasm_bindgen]
    pub fn is_using_shared_viewport(&self) -> bool {
        self.shared_viewport.is_some()
    }

    /// Start the renderer
    #[wasm_bindgen]
    pub fn start(&mut self) {
        self.state.start();
        log::info!("WorkerRenderer started");
    }

    /// Stop the renderer
    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.state.stop();
        log::info!("WorkerRenderer stopped");
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
        log::debug!("Resizing to {}x{} (DPR: {})", width, height, dpr);
        self.gl.resize(width, height);
        self.state.resize_viewport(width as f32, height as f32, dpr);
    }

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

    /// Upload a font texture from an HtmlImageElement
    #[wasm_bindgen]
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        image: &HtmlImageElement,
    ) -> Result<(), JsValue> {
        self.gl.upload_font_texture(texture_uid, image)
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
        self.gl
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

    /// Check if fonts are fully ready (metadata loaded AND all textures uploaded)
    fn fonts_ready(&self) -> bool {
        if !self.state.has_fonts() {
            return false;
        }
        for uid in self.state.get_required_texture_uids() {
            if !self.gl.has_font_texture(uid) {
                return false;
            }
        }
        true
    }

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
            text, col, row, font_size, bold, italic, color_r, color_g, color_b, align, valign,
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
        self.state.mark_fills_hash_dirty(hash_x as i64, hash_y as i64);
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
    /// Creates various cell-based and meta fills to verify rendering
    #[wasm_bindgen]
    pub fn add_test_fills(&mut self) {
        self.state.add_test_fills();
    }

    // =========================================================================
    // Cell Labels (text content)
    // =========================================================================

    /// Add multiple labels for a hash in batch (parallelized)
    /// This is more efficient than calling add_label/add_styled_label repeatedly.
    ///
    /// texts: array of text strings
    /// cols: flat array of column indices (1-indexed)
    /// rows: flat array of row indices (1-indexed)
    /// colors: optional flat array of [r, g, b, r, g, b, ...] for each label (values 0-255)
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
        self.state.add_labels_batch(
            hash_x as i64,
            hash_y as i64,
            texts,
            cols,
            rows,
            colors,
        );
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
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    #[wasm_bindgen]
    pub fn get_needed_label_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_label_hashes().into_boxed_slice()
    }

    /// Get label hashes that can be unloaded (outside viewport)
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
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
    /// Creates various cell labels to verify text rendering
    #[wasm_bindgen]
    pub fn add_test_labels(&mut self) {
        self.state.add_test_labels();
    }

    // =========================================================================
    // Auto-size (column width / row height)
    // =========================================================================

    /// Get max content width for a column (for auto-resize)
    ///
    /// Returns the unwrapped text width of the widest cell in this column.
    /// Used when double-clicking column header border to auto-fit column width.
    /// Returns 0.0 if no cells in the column.
    #[wasm_bindgen]
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.state.get_column_max_width(column)
    }

    /// Get max content height for a row (for auto-resize)
    ///
    /// Returns the height needed to display the tallest cell in this row,
    /// including descenders (characters like g, y, p that extend below baseline).
    /// Used when double-clicking row header border to auto-fit row height.
    /// Returns the default cell height (21.0) if no cells in the row.
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
    pub fn frame(&mut self, _elapsed: f32) -> bool {
        if !self.state.is_running() {
            return false;
        }

        // Sync from shared viewport buffer
        // Viewport is controlled by TypeScript and synced via SharedArrayBuffer
        if let Some(ref mut shared) = self.shared_viewport {
            let changed = shared.sync();
            if changed {
                // Update state viewport from shared buffer
                self.state.set_viewport(shared.x(), shared.y(), shared.scale());
                self.state.resize_viewport(shared.width(), shared.height(), shared.dpr());
            }
        }

        // Update content based on viewport and sheet offsets
        self.state.update_content();

        // Update headings first to get their size
        let (heading_width, heading_height) = self.state.update_headings();

        // Process dirty hashes with time budget (~8ms, half of 60fps frame)
        // This does the expensive layout/mesh work incrementally
        let (processed, remaining) = self.state.process_dirty_hashes(8.0);

        // Check if anything is dirty and needs rendering
        let needs_render = self.state.is_dirty() || processed > 0;

        if !needs_render {
            return false;
        }

        // Begin frame (clears command buffer)
        self.gl.begin_frame();

        // Clear with out-of-bounds background color (0xfdfdfd = very light gray)
        let oob_gray = 253.0 / 255.0;
        self.gl.clear(oob_gray, oob_gray, oob_gray, 1.0);

        // Get the view-projection matrix with heading offset
        let matrix = self
            .state
            .viewport
            .view_projection_matrix_with_offset(heading_width, heading_height);
        let matrix_array: [f32; 16] = matrix.to_cols_array();

        // Set viewport to content area (after headings)
        let canvas_width = self.state.viewport.width() as i32;
        let canvas_height = self.state.viewport.height() as i32;
        let content_x = heading_width as i32;
        let content_y = heading_height as i32;
        let content_width = canvas_width - heading_width as i32;
        let content_height = canvas_height - heading_height as i32;

        self.gl.set_viewport(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );

        self.gl.set_scissor(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );

        // Render content in z-order (back to front):

        // 1. Background (white grid area)
        self.render_background(&matrix_array);

        // 2. Cell fills (backgrounds) - after background, before grid lines
        self.render_fills(&matrix_array);

        // 3. Grid lines
        self.state
            .content
            .grid_lines
            .render(&mut self.gl, &matrix_array);

        // 4. Cell text
        self.render_text(&matrix_array);

        // 5. Cursor (on top of text)
        let viewport_scale = self.state.viewport.effective_scale();
        self.state
            .content
            .cursor
            .render(&mut self.gl, &matrix_array, viewport_scale);

        // Reset viewport and disable scissor for headings
        self.gl.reset_viewport();
        self.gl.disable_scissor();

        // Render headings (in screen space, on top of everything)
        if self.state.show_headings {
            self.render_headings();
        }

        // Execute all buffered draw commands
        self.gl.end_frame();

        // Mark everything as clean after rendering
        self.state.mark_clean();

        // Also clear the shared viewport buffer dirty flag
        if let Some(ref mut shared) = self.shared_viewport {
            shared.mark_clean();
        }

        // If there are remaining dirty hashes, force another frame to continue processing
        if remaining > 0 {
            self.state.force_dirty();
        }

        true
    }

    // =========================================================================
    // Layer Building Methods
    // =========================================================================

    /// Render the background (white grid area)
    fn render_background(&mut self, matrix: &[f32; 16]) {
        let bounds = self.state.viewport.visible_bounds();

        if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
            return;
        }

        let x = bounds.left.max(0.0);
        let y = bounds.top.max(0.0);
        let width = bounds.right - x;
        let height = bounds.bottom - y;

        let mut rects = crate::primitives::Rects::new();
        rects.add(x, y, width, height, [1.0, 1.0, 1.0, 1.0]);
        rects.render(&mut self.gl, matrix);
    }

    /// Render cell fills (background colors)
    fn render_fills(&mut self, matrix: &[f32; 16]) {
        let offsets = self.state.get_sheet_offsets().clone();
        self.state.fills.render(
            &mut self.gl,
            matrix,
            &self.state.viewport,
            &offsets,
        );
    }

    /// Render cell text using spatial hash culling
    fn render_text(&mut self, matrix: &[f32; 16]) {
        if self.state.hashes.is_empty() || !self.fonts_ready() {
            return;
        }

        let scale = self.state.viewport.scale();
        let effective_scale = self.state.viewport.effective_scale();

        let bounds = self.state.viewport.visible_bounds();
        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.left + bounds.width + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.top + bounds.height + padding;

        let (font_scale, distance_range) = self.state.get_text_params();

        // Render only ready hashes (dirty hashes are processed separately with time budget)
        let mut visible_count = 0;
        let mut skipped_dirty = 0;

        for hash in self.state.hashes.values_mut() {
            if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
                continue;
            }

            // Skip dirty hashes - they'll be processed next frame
            if hash.is_dirty() {
                skipped_dirty += 1;
                continue;
            }

            visible_count += 1;

            if scale < crate::text::SPRITE_SCALE_THRESHOLD {
                hash.rebuild_sprite_if_dirty(
                    &self.gl,
                    &self.state.fonts,
                    font_scale,
                    distance_range,
                );
            }

            hash.render(
                &self.gl,
                matrix,
                scale,
                effective_scale,
                font_scale,
                distance_range,
            );
        }

        if self.state.debug_show_text_updates && (visible_count > 0 || skipped_dirty > 0) {
            log::info!(
                "[render_cells_text] rendered={}, skipped_dirty={}, scale={:.2}",
                visible_count,
                skipped_dirty,
                scale
            );
        }
    }

    /// Render grid headings (column and row headers)
    fn render_headings(&mut self) {
        if !self.fonts_ready() {
            return;
        }

        let canvas_width = self.state.viewport.width();
        let canvas_height = self.state.viewport.height();

        // Layout heading labels
        self.state.headings.layout(&self.state.fonts);

        // Create screen-space matrix
        let screen_matrix = self
            .state
            .create_screen_space_matrix(canvas_width, canvas_height);

        // Get text params for headings
        let (font_scale, distance_range) = self.state.get_heading_text_params();
        let offsets = self.state.get_sheet_offsets().clone();

        // Render headings directly
        self.state.headings.render(
            &mut self.gl,
            &screen_matrix,
            &self.state.fonts,
            font_scale,
            distance_range,
            &offsets,
        );
    }

    // =========================================================================
    // Core Message Handling
    // =========================================================================

    /// Handle a bincode-encoded message from core.
    ///
    /// This is the main entry point for receiving messages from the core worker.
    /// Messages are encoded using bincode for efficiency.
    #[wasm_bindgen]
    pub fn handle_core_message(&mut self, data: &[u8]) {
        if let Err(e) = super::message_handler::handle_core_message(&mut self.state, data) {
            log::error!("[WorkerRenderer] Error handling core message: {}", e);
        }
    }
}
