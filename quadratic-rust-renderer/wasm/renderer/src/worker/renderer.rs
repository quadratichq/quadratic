//! Unified Worker Renderer
//!
//! The main entry point for browser-based rendering in a web worker.
//! Supports both WebGPU (preferred) and WebGL2 (fallback) backends.
//!
//! # Usage
//!
//! ```javascript
//! // Create renderer (auto-selects best backend)
//! const renderer = await WorkerRenderer.create(canvas);
//! ```

use js_sys::SharedArrayBuffer;
use quadratic_core_shared::ViewportBuffer;
use wasm_bindgen::prelude::*;
use web_sys::OffscreenCanvas;

use crate::sheets::text::BitmapFont;

use super::RenderBackend;
use super::js;
use super::render;
use super::state::RendererState;

use quadratic_core_shared::{RendererToCore, serialization};
use quadratic_renderer_core::RenderContext;

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
}

// ============================================================================
// JavaScript API (exposed via wasm_bindgen)
// ============================================================================

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

    /// Create a new renderer from a transferred OffscreenCanvas (async)
    ///
    /// Automatically selects WebGPU if available, falling back to WebGL2.
    /// JavaScript should use: `await WorkerRenderer.create(canvas)`
    #[wasm_bindgen]
    pub async fn create(canvas: OffscreenCanvas) -> Result<WorkerRenderer, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        let backend = RenderBackend::create(canvas).await?;
        let state = RendererState::new(width as f32, height as f32);

        Ok(Self {
            backend,
            state,
            shared_viewport: None,
        })
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
    // Dirty Flags
    // =========================================================================

    /// Mark the viewport as dirty (forces a render next frame)
    #[wasm_bindgen]
    pub fn set_viewport_dirty(&mut self) {
        self.state.set_viewport_dirty();
    }

    /// Check if any component is dirty and needs rendering
    #[wasm_bindgen]
    pub fn is_dirty(&self) -> bool {
        self.state.is_dirty()
    }

    // =========================================================================
    // Cursor
    // =========================================================================

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

    /// Upload a font texture from raw RGBA pixel data
    #[wasm_bindgen]
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        self.backend
            .upload_font_texture(texture_uid, width, height, data)?;
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
            .upload_font_texture(texture_uid, width, height, data)?;

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

    // =========================================================================
    // Fills (cell backgrounds)
    // =========================================================================

    /// Check if meta fills have been loaded
    #[wasm_bindgen]
    pub fn fills_meta_loaded(&self) -> bool {
        self.state.fills_meta_loaded()
    }

    /// Get fill hashes that need to be loaded (visible but not yet loaded)
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
    #[wasm_bindgen]
    pub fn get_needed_fill_hashes(&self) -> Box<[i32]> {
        self.state.get_needed_fill_hashes().into_boxed_slice()
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
                // Update current sheet if it changed
                if let Some(sheet_id) = shared.sheet_id() {
                    self.state.set_current_sheet(sheet_id);
                }
            }
            changed
        } else {
            false
        };

        // NOTE: Hash requests are now handled exclusively by the Layout Worker.
        // The Render Worker receives pre-computed RenderBatch from Layout Worker.

        // Update UI content based on viewport (grid lines, cursor, headings)
        self.state.update_content();

        // Check if we need to render:
        // - New data from layout worker
        // - State is dirty (viewport changed, etc.)
        // - We have cached hash data to render
        let has_new_batch_data = self.state.batch_cache.has_new_data();
        let has_cached_data = self.state.batch_cache.has_hashes();
        let needs_render =
            self.state.is_dirty() || has_new_batch_data || (viewport_changed && has_cached_data);

        if !needs_render {
            return false;
        }

        // Render using unified wgpu backend (handles both WebGPU and WebGL2)
        let rendered = self.frame_impl(elapsed);

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
        self.state.batch_cache.has_new_data()
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

    /// Unified frame rendering using RenderContext API
    ///
    /// This method uses core's RenderContext trait which works with both
    /// WebGPU and WebGL2 backends via wgpu.
    fn frame_impl(&mut self, _elapsed: f32) -> bool {
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
        let _scale = self.state.viewport.scale();
        let effective_scale = self.state.viewport.effective_scale();
        let (atlas_font_size, distance_range) = self.state.get_text_params();
        let show_headings = self.state.show_headings;
        let offsets = self.state.get_sheet_offsets().clone();
        let screen_matrix_array = self
            .state
            .create_screen_space_matrix(canvas_width, canvas_height);
        let (heading_atlas_font_size, heading_distance_range) =
            self.state.get_heading_text_params();

        // Pre-extract background vertices
        let bg_vertices = render::get_background_vertices(&self.state.viewport);

        // Pre-extract fill vertices
        let (meta_fill_vertices, hash_fill_vertices) =
            if let Some(sheet) = self.state.sheets.current_sheet_mut() {
                render::get_fill_vertices(sheet, &self.state.viewport)
            } else {
                (None, Vec::new())
            };

        // Pre-extract table vertices
        let (table_name_bg, table_col_bg, table_outlines, table_header_lines, table_text_meshes) =
            if fonts_ready {
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

        // Pre-extract cached hash data for text rendering
        let cached_hashes = self.state.batch_cache.get_hashes_vec();

        // Pre-extract heading data if needed (before borrowing context)
        let heading_data = if show_headings && fonts_ready {
            self.state.ui.headings.layout(&self.state.fonts);
            Some(self.state.ui.headings.get_render_data(
                &self.state.fonts,
                heading_atlas_font_size,
                heading_distance_range,
                &offsets,
            ))
        } else {
            None
        };

        // Get render context
        let ctx = self.backend.context_mut();

        // Begin frame
        ctx.begin_frame();

        // Clear with out-of-bounds background color
        let oob_gray = 253.0 / 255.0;
        ctx.clear(oob_gray, oob_gray, oob_gray, 1.0);

        // Set viewport to content area (after headings)
        ctx.set_viewport(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );
        ctx.set_scissor(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );

        // 1. Background
        if let Some(ref vertices) = bg_vertices {
            ctx.draw_triangles(vertices, &matrix_array);
        }

        // 2. Fills
        if let Some(ref vertices) = meta_fill_vertices {
            ctx.draw_triangles(vertices, &matrix_array);
        }
        for vertices in &hash_fill_vertices {
            ctx.draw_triangles(vertices, &matrix_array);
        }

        // 3. Grid lines
        if let Some(ref line_vertices) = grid_line_vertices {
            ctx.draw_lines(line_vertices, &matrix_array);
        }

        // 4. Text - render from cached hash data
        if fonts_ready && !cached_hashes.is_empty() {
            for hash_data in &cached_hashes {
                for buf in &hash_data.text_buffers {
                    if buf.vertices.is_empty() {
                        continue;
                    }
                    let font_scale = buf.font_size / atlas_font_size;
                    ctx.draw_text(
                        &buf.vertices,
                        &buf.indices,
                        buf.texture_uid,
                        &matrix_array,
                        effective_scale,
                        font_scale,
                        distance_range,
                    );
                }
            }
        }

        // 5. Table headers
        if !table_name_bg.is_empty() {
            ctx.draw_triangles(&table_name_bg, &matrix_array);
        }
        if !table_col_bg.is_empty() {
            ctx.draw_triangles(&table_col_bg, &matrix_array);
        }
        if !table_outlines.is_empty() {
            ctx.draw_lines(&table_outlines, &matrix_array);
        }
        if !table_header_lines.is_empty() {
            ctx.draw_lines(&table_header_lines, &matrix_array);
        }
        for mesh in &table_text_meshes {
            if mesh.is_empty() {
                continue;
            }
            let font_scale = mesh.font_size / atlas_font_size;
            ctx.draw_text(
                &mesh.get_vertex_data(),
                mesh.get_index_data(),
                mesh.texture_uid,
                &matrix_array,
                effective_scale,
                font_scale,
                distance_range,
            );
        }

        // 7. Cursor
        if let Some(ref fill_vertices) = cursor_fill_vertices {
            ctx.draw_triangles(fill_vertices, &matrix_array);
        }
        if let Some(ref border_vertices) = cursor_border_vertices {
            ctx.draw_triangles(border_vertices, &matrix_array);
        }

        // 8. Headings (screen space)
        ctx.reset_viewport();
        ctx.disable_scissor();

        if let Some((bg_vertices, line_vertices, text_meshes)) = heading_data {
            // Draw heading backgrounds
            if !bg_vertices.is_empty() {
                ctx.draw_triangles(&bg_vertices, &screen_matrix_array);
            }
            // Draw heading grid lines
            if !line_vertices.is_empty() {
                ctx.draw_lines(&line_vertices, &screen_matrix_array);
            }
            // Draw heading text
            for (vertices, indices, texture_uid, font_size) in &text_meshes {
                if vertices.is_empty() {
                    continue;
                }
                let font_scale = font_size / heading_atlas_font_size;
                ctx.draw_text(
                    vertices,
                    indices,
                    *texture_uid,
                    &screen_matrix_array,
                    1.0, // headings use screen space
                    font_scale,
                    heading_distance_range,
                );
            }
        }

        // Execute all buffered draw commands
        ctx.end_frame();

        true
    }
}
