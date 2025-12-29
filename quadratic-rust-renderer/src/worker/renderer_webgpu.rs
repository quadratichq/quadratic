//! WebGPU Worker Renderer
//!
//! The WebGPU implementation of the worker renderer.
//! This mirrors the WebGL WorkerRenderer API but uses WebGPU (via wgpu) for rendering.

#[cfg(target_arch = "wasm32")]
use js_sys::SharedArrayBuffer;
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use web_sys::OffscreenCanvas;

#[cfg(target_arch = "wasm32")]
use crate::content::grid_lines::calculate_grid_alpha;
#[cfg(target_arch = "wasm32")]
use crate::render_context::RenderContext;
#[cfg(target_arch = "wasm32")]
use crate::text::BitmapFont;
use crate::viewport::ViewportBuffer;
use crate::webgpu::WebGPUContext;

use super::state::RendererState;

/// WebGPU-based renderer for browser worker
///
/// This is the WebGPU version of WorkerRenderer.
/// It provides the same API but uses WebGPU (via wgpu) for rendering.
#[wasm_bindgen]
pub struct WorkerRendererGPU {
    /// WebGPU rendering context
    gpu: WebGPUContext,

    /// Shared renderer state
    state: RendererState,

    /// Optional shared viewport buffer (when viewport is controlled by main thread)
    shared_viewport: Option<ViewportBuffer>,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl WorkerRendererGPU {
    /// Check if WebGPU is available in this browser
    #[wasm_bindgen]
    pub fn is_available() -> bool {
        WebGPUContext::is_available()
    }

    /// Create a new WebGPU renderer from a transferred OffscreenCanvas
    /// This is async because WebGPU device creation is async
    #[wasm_bindgen]
    pub async fn new(canvas: OffscreenCanvas) -> Result<WorkerRendererGPU, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        log::info!("Creating WorkerRendererGPU ({}x{})", width, height);
        let gpu = WebGPUContext::from_offscreen_canvas(canvas).await?;
        let state = RendererState::new(width as f32, height as f32);

        Ok(Self {
            gpu,
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
        log::info!("Setting shared viewport buffer (WebGPU)");
        let vb = ViewportBuffer::from_buffer(buffer);
        log::info!(
            "[WebGPU] Initial viewport buffer values: x={:.1}, y={:.1}, scale={:.2}, size={}x{}, dpr={}",
            vb.x(),
            vb.y(),
            vb.scale(),
            vb.width(),
            vb.height(),
            vb.dpr()
        );
        self.shared_viewport = Some(vb);
    }

    /// Check if using shared viewport
    #[wasm_bindgen]
    pub fn is_using_shared_viewport(&self) -> bool {
        self.shared_viewport.is_some()
    }

    /// Get the backend name
    #[wasm_bindgen]
    pub fn backend_name(&self) -> String {
        "WebGPU".to_string()
    }

    /// Start the renderer
    #[wasm_bindgen]
    pub fn start(&mut self) {
        self.state.start();
        log::info!("WorkerRendererGPU started");
    }

    /// Stop the renderer
    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.state.stop();
        log::info!("WorkerRendererGPU stopped");
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
        self.gpu.resize(width, height);
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
    #[wasm_bindgen]
    pub fn set_selected_columns(&mut self, selections: &[i32]) {
        self.state.set_selected_columns(selections);
    }

    /// Set selected rows for heading highlight
    #[wasm_bindgen]
    pub fn set_selected_rows(&mut self, selections: &[i32]) {
        self.state.set_selected_rows(selections);
    }

    /// Set device pixel ratio for headings
    #[wasm_bindgen]
    pub fn set_headings_dpr(&mut self, dpr: f32) {
        self.state.set_headings_dpr(dpr);
    }

    // =========================================================================
    // Dirty Flags
    // =========================================================================

    /// Mark viewport as dirty
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

    /// Check if any component is dirty
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

    /// Upload a font texture from raw RGBA pixel data
    #[wasm_bindgen]
    pub fn upload_font_texture_from_data(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        self.gpu
            .upload_font_texture_from_data(texture_uid, width, height, data)?;
        // Mark headings dirty so they render now that textures are available
        self.state.set_headings_dirty();
        Ok(())
    }

    /// Add a font from JSON data
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

    /// Check if fonts are fully ready
    fn fonts_ready(&self) -> bool {
        if !self.state.has_fonts() {
            return false;
        }
        for uid in self.state.get_required_texture_uids() {
            if !self.gpu.has_font_texture(uid) {
                return false;
            }
        }
        true
    }

    /// Add a cell label
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

    /// Get visible hash bounds
    #[wasm_bindgen]
    pub fn get_visible_hash_bounds(&self) -> Box<[i32]> {
        Box::new(self.state.get_visible_hash_bounds())
    }

    /// Get list of hashes that need to be loaded
    #[wasm_bindgen]
    pub fn get_needed_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_hashes().into_boxed_slice()
    }

    /// Get list of offscreen hashes
    #[wasm_bindgen]
    pub fn get_offscreen_hashes(&self) -> Box<[i32]> {
        self.state.get_offscreen_hashes().into_boxed_slice()
    }

    /// Remove a hash
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

    /// Get total sprite cache memory
    #[wasm_bindgen]
    pub fn get_sprite_memory_bytes(&self) -> usize {
        self.state.get_sprite_memory_bytes()
    }

    /// Get number of sprite caches
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

    /// Get fill hashes that need to be loaded
    #[wasm_bindgen]
    pub fn get_needed_fill_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_fill_hashes().into_boxed_slice()
    }

    /// Get fill hashes that can be unloaded
    #[wasm_bindgen]
    pub fn get_offscreen_fill_hashes(&self) -> Box<[i32]> {
        self.state.get_offscreen_fill_hashes().into_boxed_slice()
    }

    /// Unload a fill hash
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
                self.state
                    .set_viewport(shared.x(), shared.y(), shared.scale());
                self.state
                    .resize_viewport(shared.width(), shared.height(), shared.dpr());
            }
        }

        // Update content based on viewport and sheet offsets
        self.state.update_content();

        // Update headings
        let (heading_width, heading_height) = self.state.update_headings();

        // Process dirty hashes with time budget (~8ms, half of 60fps frame)
        // This does the expensive layout/mesh work incrementally
        let (processed, remaining) = self.state.process_dirty_hashes(8.0);

        // Check if anything needs rendering
        let needs_render = self.state.is_dirty() || processed > 0;

        if !needs_render {
            return false;
        }

        // Rebuild sprite caches if zoomed out (must happen before main render pass)
        let scale = self.state.viewport.scale();
        if scale < crate::text::SPRITE_SCALE_THRESHOLD {
            let (font_scale, distance_range) = self.state.get_text_params();

            for hash in self.state.hashes.values_mut() {
                hash.rebuild_sprite_if_dirty_webgpu(
                    &mut self.gpu,
                    &self.state.fonts,
                    font_scale,
                    distance_range,
                );
            }
        }

        // Get surface texture
        let output = match self.gpu.get_current_texture() {
            Ok(t) => t,
            Err(e) => {
                log::error!("Failed to get surface texture: {:?}", e);
                return false;
            }
        };

        let view = output
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder =
            self.gpu
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

            // Get the view-projection matrix
            let matrix = self
                .state
                .viewport
                .view_projection_matrix_with_offset(heading_width, heading_height);
            let matrix_array: [f32; 16] = matrix.to_cols_array();

            // Set viewport to content area (after headings)
            let canvas_width = self.state.viewport.width() as u32;
            let canvas_height = self.state.viewport.height() as u32;
            let content_x = heading_width as u32;
            let content_y = heading_height as u32;
            let content_width = canvas_width.saturating_sub(content_x);
            let content_height = canvas_height.saturating_sub(content_y);

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

            // Render background
            self.render_background(&mut pass, &matrix_array);

            // Render cell fills (backgrounds)
            self.render_fills(&mut pass, &matrix_array);

            // Render grid lines
            self.render_grid_lines(&mut pass, &matrix_array);

            // Render text
            self.render_text(&mut pass, &matrix_array);

            // Render cursor (fill and border)
            self.render_cursor(&mut pass, &matrix_array);
        }

        // Render headings in a second pass (screen space)
        if self.state.show_headings && self.fonts_ready() {
            // Layout heading labels
            self.state.headings.layout(&self.state.fonts);

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

            // Reset viewport and scissor to full canvas for headings
            // Use texture dimensions directly to avoid mismatch with surface config
            let tex_width = output.texture.width();
            let tex_height = output.texture.height();
            pass.set_viewport(0.0, 0.0, tex_width as f32, tex_height as f32, 0.0, 1.0);
            pass.set_scissor_rect(0, 0, tex_width, tex_height);

            // Render headings in screen space
            self.render_headings(&mut pass);
        }

        // Submit
        self.gpu.queue().submit(std::iter::once(encoder.finish()));
        output.present();

        // Mark clean
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

    fn render_background(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        let bounds = self.state.viewport.visible_bounds();

        if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
            return;
        }

        let x = bounds.left.max(0.0);
        let y = bounds.top.max(0.0);
        let width = bounds.right - x;
        let height = bounds.bottom - y;

        // Create a white rectangle (grid background)
        let x2 = x + width;
        let y2 = y + height;
        let color = [1.0f32, 1.0, 1.0, 1.0];

        let vertices: [f32; 36] = [
            // Triangle 1
            x, y, color[0], color[1], color[2], color[3], x2, y, color[0], color[1], color[2],
            color[3], x2, y2, color[0], color[1], color[2], color[3], // Triangle 2
            x, y, color[0], color[1], color[2], color[3], x2, y2, color[0], color[1], color[2],
            color[3], x, y2, color[0], color[1], color[2], color[3],
        ];

        self.gpu.draw_triangles(pass, &vertices, matrix);
    }

    fn render_fills(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        let bounds = self.state.viewport.visible_bounds();
        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.right + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.bottom + padding;

        // Render meta fills first (infinite backgrounds)
        let meta_vertices = self.state.fills.cached_meta_rects().vertices();
        if !meta_vertices.is_empty() {
            self.gpu.draw_triangles(pass, meta_vertices, matrix);
        }

        // Render hash fills (finite cell backgrounds)
        for hash in self.state.fills.fills_by_hash_values() {
            if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
                continue;
            }

            let vertices = hash.cached_rects().vertices();
            if !vertices.is_empty() {
                self.gpu.draw_triangles(pass, vertices, matrix);
            }
        }
    }

    fn render_grid_lines(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        if let Some(line_vertices) = self.state.content.grid_lines.get_vertices() {
            self.gpu.draw_lines(pass, line_vertices, matrix);
        }
    }

    fn render_cursor(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        // Get cursor fill vertices (rectangles)
        if let Some(vertices) = self.state.content.cursor.get_fill_vertices() {
            self.gpu.draw_triangles(pass, vertices, matrix);
        }

        // Get cursor border vertices
        let scale = self.state.viewport.effective_scale();
        if let Some(triangle_vertices) = self.state.content.cursor.get_border_vertices(scale) {
            self.gpu.draw_triangles(pass, triangle_vertices, matrix);
        }
    }

    fn render_text(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
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

            hash.render_webgpu(
                &mut self.gpu,
                pass,
                matrix,
                scale,
                effective_scale,
                font_scale,
                distance_range,
            );
        }

        if self.state.debug_show_text_updates && (visible_count > 0 || skipped_dirty > 0) {
            log::info!(
                "[render_labels] rendered={}, skipped_dirty={}, scale={:.2}",
                visible_count,
                skipped_dirty,
                scale
            );
        }
    }

    /// Render grid headings (column and row headers) in screen space
    fn render_headings(&mut self, pass: &mut wgpu::RenderPass<'_>) {
        use crate::primitives::{NativeLines, Rects};

        let canvas_width = self.state.viewport.width();
        let canvas_height = self.state.viewport.height();

        // Create screen-space matrix
        let screen_matrix = self
            .state
            .create_screen_space_matrix(canvas_width, canvas_height);

        // 1. Render backgrounds
        let mut rects = Rects::with_capacity(8);
        let (col_rect, row_rect, corner_rect) = self.state.headings.get_background_rects();
        let colors = &self.state.headings.colors;

        rects.add(
            col_rect[0],
            col_rect[1],
            col_rect[2],
            col_rect[3],
            colors.background,
        );
        rects.add(
            row_rect[0],
            row_rect[1],
            row_rect[2],
            row_rect[3],
            colors.background,
        );
        rects.add(
            corner_rect[0],
            corner_rect[1],
            corner_rect[2],
            corner_rect[3],
            colors.corner_background,
        );

        // Selection highlights
        let selection_color = [
            colors.selection[0],
            colors.selection[1],
            colors.selection[2],
            colors.selection_alpha,
        ];
        for rect in self
            .state
            .headings
            .get_selection_rects(self.state.get_sheet_offsets())
        {
            rects.add(rect[0], rect[1], rect[2], rect[3], selection_color);
        }

        // Debug rectangles if enabled
        if self.state.headings.debug_label_bounds {
            let (anchor_points, text_bounds) = self.state.headings.get_debug_label_rects();

            let anchor_color = [1.0, 0.0, 0.0, 1.0];
            for rect in anchor_points {
                rects.add(rect[0], rect[1], rect[2], rect[3], anchor_color);
            }

            let bounds_color = [0.0, 0.0, 1.0, 0.3];
            for rect in text_bounds {
                rects.add(rect[0], rect[1], rect[2], rect[3], bounds_color);
            }
        }

        // Render background rectangles
        if !rects.is_empty() {
            self.gpu
                .draw_triangles(pass, rects.vertices(), &screen_matrix);
        }

        // 2. Render grid lines (with fade matching main grid lines)
        let grid_line_coords = self
            .state
            .headings
            .get_grid_lines(self.state.get_sheet_offsets());
        let mut lines = NativeLines::with_capacity(grid_line_coords.len() / 4);

        // Apply same alpha fading as main grid lines based on zoom level
        let scale = self.state.viewport.scale();
        let alpha = calculate_grid_alpha(scale);
        let grid_line_color = [
            colors.grid_line[0],
            colors.grid_line[1],
            colors.grid_line[2],
            colors.grid_line[3] * alpha,
        ];

        for chunk in grid_line_coords.chunks(4) {
            if chunk.len() == 4 {
                lines.add(chunk[0], chunk[1], chunk[2], chunk[3], grid_line_color);
            }
        }

        if !lines.is_empty() {
            let line_vertices = lines.get_vertices();
            self.gpu.draw_lines(pass, line_vertices, &screen_matrix);
        }

        // 3. Render text
        // Get params first to avoid borrow conflict with get_meshes
        let (font_scale, distance_range) = self.state.get_heading_text_params();
        let meshes = self.state.headings.get_meshes(&self.state.fonts);

        for mesh in meshes {
            if mesh.is_empty() {
                continue;
            }
            let vertices = mesh.get_vertex_data();
            let indices: Vec<u32> = mesh.get_index_data().iter().map(|&i| i as u32).collect();

            self.gpu.draw_text(
                pass,
                &vertices,
                &indices,
                mesh.texture_uid,
                &screen_matrix,
                1.0,
                font_scale,
                distance_range,
            );
        }
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
            log::error!("[WorkerRendererGPU] Error handling core message: {}", e);
        }
    }
}
