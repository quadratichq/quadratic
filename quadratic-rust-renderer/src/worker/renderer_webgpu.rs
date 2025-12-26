//! WebGPU Worker Renderer
//!
//! The WebGPU implementation of the worker renderer.
//! This mirrors the WebGL WorkerRenderer API but uses WebGPU (via wgpu) for rendering.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use web_sys::OffscreenCanvas;

use crate::content::Content;
use crate::headings::GridHeadings;
#[cfg(target_arch = "wasm32")]
use crate::render_context::RenderContext;
#[cfg(target_arch = "wasm32")]
use crate::text::{
    BitmapFont, CellLabel, DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, VisibleHashBounds,
    get_hash_coords, hash_key,
};
use crate::text::{BitmapFonts, CellsTextHash};
use crate::viewport::Viewport;
use crate::webgpu::WebGPUContext;

/// WebGPU-based renderer for browser worker
///
/// This is the WebGPU version of WorkerRenderer.
/// It provides the same API but uses WebGPU (via wgpu) for rendering.
#[wasm_bindgen]
pub struct WorkerRendererGPU {
    /// WebGPU rendering context
    gpu: WebGPUContext,

    /// Viewport (camera/zoom/pan state)
    viewport: Viewport,

    /// Renderable content
    content: Content,

    /// Bitmap fonts for text rendering
    fonts: BitmapFonts,

    /// Spatial hashes containing cell labels
    hashes: HashMap<u64, CellsTextHash>,

    /// Total label count
    label_count: usize,

    /// Whether the renderer is running
    running: bool,

    /// Grid headings
    headings: GridHeadings,

    /// Whether to render headings
    show_headings: bool,
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
        let viewport = Viewport::new(width as f32, height as f32);
        let content = Content::new();

        Ok(Self {
            gpu,
            viewport,
            content,
            fonts: BitmapFonts::new(),
            hashes: HashMap::new(),
            label_count: 0,
            running: false,
            headings: GridHeadings::new(),
            show_headings: true,
        })
    }

    /// Get the backend name
    #[wasm_bindgen]
    pub fn backend_name(&self) -> String {
        "WebGPU".to_string()
    }

    /// Start the renderer
    #[wasm_bindgen]
    pub fn start(&mut self) {
        self.running = true;
        log::info!("WorkerRendererGPU started");
    }

    /// Stop the renderer
    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.running = false;
        log::info!("WorkerRendererGPU stopped");
    }

    /// Check if running
    #[wasm_bindgen]
    pub fn is_running(&self) -> bool {
        self.running
    }

    /// Resize the renderer
    #[wasm_bindgen]
    pub fn resize(&mut self, width: u32, height: u32) {
        log::debug!("Resizing to {}x{}", width, height);
        self.gpu.resize(width, height);
        self.viewport.resize(width as f32, height as f32);
    }

    /// Pan the viewport
    #[wasm_bindgen]
    pub fn pan(&mut self, dx: f32, dy: f32) {
        self.viewport.pan(dx, dy);
    }

    /// Zoom the viewport
    #[wasm_bindgen]
    pub fn zoom(&mut self, factor: f32, center_x: f32, center_y: f32) {
        self.viewport.zoom(factor, center_x, center_y);
    }

    /// Set viewport position directly
    #[wasm_bindgen]
    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.viewport.set_position(x, y);
        self.viewport.set_scale(scale);
    }

    /// Get current scale
    #[wasm_bindgen]
    pub fn get_scale(&self) -> f32 {
        self.viewport.scale()
    }

    /// Get viewport X
    #[wasm_bindgen]
    pub fn get_x(&self) -> f32 {
        self.viewport.x()
    }

    /// Get viewport Y
    #[wasm_bindgen]
    pub fn get_y(&self) -> f32 {
        self.viewport.y()
    }

    // =========================================================================
    // Headings
    // =========================================================================

    /// Toggle headings visibility
    #[wasm_bindgen]
    pub fn set_show_headings(&mut self, show: bool) {
        self.show_headings = show;
    }

    /// Get headings visibility
    #[wasm_bindgen]
    pub fn get_show_headings(&self) -> bool {
        self.show_headings
    }

    /// Get heading size (row header width in pixels)
    #[wasm_bindgen]
    pub fn get_heading_width(&self) -> f32 {
        self.headings.heading_size().width
    }

    /// Get heading size (column header height in pixels)
    #[wasm_bindgen]
    pub fn get_heading_height(&self) -> f32 {
        self.headings.heading_size().height
    }

    /// Set selected columns for heading highlight
    #[wasm_bindgen]
    pub fn set_selected_columns(&mut self, selections: &[i32]) {
        let pairs: Vec<(i64, i64)> = selections
            .chunks(2)
            .filter_map(|chunk| {
                if chunk.len() == 2 {
                    Some((chunk[0] as i64, chunk[1] as i64))
                } else {
                    None
                }
            })
            .collect();
        self.headings.set_selected_columns(pairs);
    }

    /// Set selected rows for heading highlight
    #[wasm_bindgen]
    pub fn set_selected_rows(&mut self, selections: &[i32]) {
        let pairs: Vec<(i64, i64)> = selections
            .chunks(2)
            .filter_map(|chunk| {
                if chunk.len() == 2 {
                    Some((chunk[0] as i64, chunk[1] as i64))
                } else {
                    None
                }
            })
            .collect();
        self.headings.set_selected_rows(pairs);
    }

    /// Set device pixel ratio for headings
    #[wasm_bindgen]
    pub fn set_headings_dpr(&mut self, dpr: f32) {
        self.headings.set_dpr(dpr);
    }

    // =========================================================================
    // Deceleration (momentum scrolling)
    // =========================================================================

    /// Called when drag/pan starts
    #[wasm_bindgen]
    pub fn on_drag_start(&mut self) {
        self.viewport.on_drag_start();
    }

    /// Called during drag/pan
    #[wasm_bindgen]
    pub fn on_drag_move(&mut self, time: f64) {
        self.viewport.on_drag_move(time);
    }

    /// Called when drag/pan ends
    #[wasm_bindgen]
    pub fn on_drag_end(&mut self, time: f64) {
        self.viewport.on_drag_end(time);
    }

    /// Called on wheel event
    #[wasm_bindgen]
    pub fn on_wheel_event(&mut self) {
        self.viewport.on_wheel();
    }

    /// Update deceleration
    #[wasm_bindgen]
    pub fn update_decelerate(&mut self, elapsed: f32) -> bool {
        self.viewport.update_decelerate(elapsed)
    }

    /// Check if decelerating
    #[wasm_bindgen]
    pub fn is_decelerating(&self) -> bool {
        self.viewport.is_decelerating() || self.viewport.is_snapping_back()
    }

    /// Manually activate deceleration
    #[wasm_bindgen]
    pub fn activate_decelerate(&mut self, vx: f32, vy: f32) {
        self.viewport.activate_decelerate(vx, vy);
    }

    /// Reset deceleration
    #[wasm_bindgen]
    pub fn reset_decelerate(&mut self) {
        self.viewport.reset_decelerate();
    }

    // =========================================================================
    // Dirty Flags
    // =========================================================================

    /// Mark viewport as dirty
    #[wasm_bindgen]
    pub fn set_viewport_dirty(&mut self) {
        self.viewport.dirty = true;
    }

    /// Mark grid lines as dirty
    #[wasm_bindgen]
    pub fn set_grid_lines_dirty(&mut self) {
        self.content.grid_lines.dirty = true;
    }

    /// Mark cursor as dirty
    #[wasm_bindgen]
    pub fn set_cursor_dirty(&mut self) {
        self.content.cursor.dirty = true;
    }

    /// Mark headings as dirty
    #[wasm_bindgen]
    pub fn set_headings_dirty(&mut self) {
        self.headings.set_dirty();
    }

    /// Check if any component is dirty
    #[wasm_bindgen]
    pub fn is_dirty(&self) -> bool {
        self.viewport.dirty
            || self.content.is_dirty()
            || self.headings.is_dirty()
            || self.any_visible_hash_dirty()
    }

    /// Set cursor position
    #[wasm_bindgen]
    pub fn set_cursor(&mut self, col: i64, row: i64) {
        self.content.cursor.set_selected_cell(col, row);
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
        self.content
            .cursor
            .set_selection(start_col, start_row, end_col, end_row);
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
            .upload_font_texture_from_data(texture_uid, width, height, data)
    }

    /// Add a font from JSON data
    #[wasm_bindgen]
    pub fn add_font(&mut self, font_json: &str) -> Result<(), JsValue> {
        let font: BitmapFont = serde_json::from_str(font_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse font JSON: {}", e)))?;

        log::info!("Added font: {} with {} chars", font.font, font.chars.len());
        self.fonts.add(font);
        Ok(())
    }

    /// Check if fonts are loaded
    #[wasm_bindgen]
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    /// Check if fonts are fully ready
    fn fonts_ready(&self) -> bool {
        if self.fonts.is_empty() {
            return false;
        }
        for uid in self.fonts.get_required_texture_uids() {
            if !self.gpu.has_font_texture(uid) {
                return false;
            }
        }
        true
    }

    /// Add a cell label
    #[wasm_bindgen]
    pub fn add_label(
        &mut self,
        text: &str,
        cell_x: f32,
        cell_y: f32,
        cell_width: f32,
        cell_height: f32,
    ) {
        let col = (cell_x / DEFAULT_CELL_WIDTH) as i64;
        let row = (cell_y / DEFAULT_CELL_HEIGHT) as i64;

        let mut label = CellLabel::new(text.to_string(), cell_x, cell_y, cell_width, cell_height);
        label.layout(&self.fonts);

        self.insert_label(col, row, label);
    }

    /// Add a styled cell label
    #[wasm_bindgen]
    pub fn add_styled_label(
        &mut self,
        text: &str,
        cell_x: f32,
        cell_y: f32,
        cell_width: f32,
        cell_height: f32,
        font_size: f32,
        bold: bool,
        italic: bool,
        color_r: f32,
        color_g: f32,
        color_b: f32,
        align: u8,
        valign: u8,
    ) {
        use crate::text::cell_label::{TextAlign, VerticalAlign};

        let col = (cell_x / DEFAULT_CELL_WIDTH) as i64;
        let row = (cell_y / DEFAULT_CELL_HEIGHT) as i64;

        let mut label = CellLabel::new(text.to_string(), cell_x, cell_y, cell_width, cell_height);
        label.font_size = font_size;
        label.bold = bold;
        label.italic = italic;
        label.color = [color_r, color_g, color_b, 1.0];
        label.align = match align {
            1 => TextAlign::Center,
            2 => TextAlign::Right,
            _ => TextAlign::Left,
        };
        label.vertical_align = match valign {
            0 => VerticalAlign::Top,
            1 => VerticalAlign::Middle,
            _ => VerticalAlign::Bottom,
        };
        label.layout(&self.fonts);

        self.insert_label(col, row, label);
    }

    fn insert_label(&mut self, col: i64, row: i64, label: CellLabel) {
        let (hash_x, hash_y) = get_hash_coords(col, row);
        let key = hash_key(hash_x, hash_y);

        let hash = self
            .hashes
            .entry(key)
            .or_insert_with(|| CellsTextHash::new(hash_x, hash_y));
        hash.add_label(col, row, label);
        self.label_count += 1;
    }

    /// Clear all labels
    #[wasm_bindgen]
    pub fn clear_labels(&mut self) {
        self.hashes.clear();
        self.label_count = 0;
    }

    /// Get total label count
    #[wasm_bindgen]
    pub fn get_label_count(&self) -> usize {
        self.label_count
    }

    // =========================================================================
    // Lazy Loading API
    // =========================================================================

    /// Get visible hash bounds
    #[wasm_bindgen]
    pub fn get_visible_hash_bounds(&self) -> Box<[i32]> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
        );

        Box::new([
            hash_bounds.min_hash_x as i32,
            hash_bounds.max_hash_x as i32,
            hash_bounds.min_hash_y as i32,
            hash_bounds.max_hash_y as i32,
        ])
    }

    /// Get list of hashes that need to be loaded
    #[wasm_bindgen]
    pub fn get_needed_hashes(&self) -> Box<[i32]> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
        );

        let mut needed: Vec<i32> = Vec::new();

        for (hash_x, hash_y) in hash_bounds.iter() {
            let key = hash_key(hash_x, hash_y);
            if !self.hashes.contains_key(&key) {
                needed.push(hash_x as i32);
                needed.push(hash_y as i32);
            }
        }

        needed.into_boxed_slice()
    }

    /// Get list of offscreen hashes
    #[wasm_bindgen]
    pub fn get_offscreen_hashes(&self) -> Box<[i32]> {
        let bounds = self.viewport.visible_bounds();
        let hash_bounds = VisibleHashBounds::from_viewport(
            bounds.left,
            bounds.top,
            bounds.width,
            bounds.height,
            self.viewport.scale(),
        );

        let mut offscreen: Vec<i32> = Vec::new();

        for hash in self.hashes.values() {
            if !hash_bounds.contains(hash.hash_x, hash.hash_y) {
                offscreen.push(hash.hash_x as i32);
                offscreen.push(hash.hash_y as i32);
            }
        }

        offscreen.into_boxed_slice()
    }

    /// Remove a hash
    #[wasm_bindgen]
    pub fn remove_hash(&mut self, hash_x: i32, hash_y: i32) {
        let key = hash_key(hash_x as i64, hash_y as i64);
        if let Some(hash) = self.hashes.remove(&key) {
            self.label_count = self.label_count.saturating_sub(hash.label_count());
        }
    }

    /// Check if a hash is loaded
    #[wasm_bindgen]
    pub fn has_hash(&self, hash_x: i32, hash_y: i32) -> bool {
        let key = hash_key(hash_x as i64, hash_y as i64);
        self.hashes.contains_key(&key)
    }

    /// Get number of loaded hashes
    #[wasm_bindgen]
    pub fn get_hash_count(&self) -> usize {
        self.hashes.len()
    }

    /// Get total sprite cache memory
    #[wasm_bindgen]
    pub fn get_sprite_memory_bytes(&self) -> usize {
        self.hashes
            .values()
            .map(|hash| hash.sprite_memory_bytes())
            .sum()
    }

    /// Get number of sprite caches
    #[wasm_bindgen]
    pub fn get_sprite_count(&self) -> usize {
        self.hashes
            .values()
            .filter(|hash| hash.has_sprite_cache())
            .count()
    }

    // =========================================================================
    // Frame Rendering
    // =========================================================================

    /// Render a single frame
    #[wasm_bindgen]
    pub fn frame(&mut self, elapsed: f32) -> bool {
        if !self.running {
            return false;
        }

        // Update deceleration
        self.viewport.update_decelerate(elapsed);

        // Update content
        self.content.update(&self.viewport);

        // Update headings
        let (heading_width, heading_height) = if self.show_headings {
            let scale = self.viewport.scale();
            let canvas_width = self.viewport.width();
            let canvas_height = self.viewport.height();

            self.headings.update(
                self.viewport.x(),
                self.viewport.y(),
                scale,
                canvas_width,
                canvas_height,
            );

            let size = self.headings.heading_size();
            (size.width, size.height)
        } else {
            (0.0, 0.0)
        };

        // Check if anything needs rendering
        let viewport_dirty = self.viewport.dirty;
        let content_dirty = self.content.is_dirty();
        let headings_dirty = self.headings.is_dirty();
        let hashes_dirty = self.any_visible_hash_dirty();

        let needs_render = viewport_dirty || content_dirty || headings_dirty || hashes_dirty;

        if !needs_render {
            return false;
        }

        // Rebuild sprite caches if zoomed out (must happen before main render pass)
        let scale = self.viewport.scale();
        if scale < crate::text::SPRITE_SCALE_THRESHOLD {
            let (font_scale, distance_range) = self
                .fonts
                .get("OpenSans")
                .map(|f| {
                    let render_size = 14.0;
                    (render_size / f.size, f.distance_range)
                })
                .unwrap_or((14.0 / 42.0, 4.0));

            for hash in self.hashes.values_mut() {
                hash.rebuild_sprite_if_dirty_webgpu(
                    &mut self.gpu,
                    &self.fonts,
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
                .viewport
                .view_projection_matrix_with_offset(heading_width, heading_height);
            let matrix_array: [f32; 16] = matrix.to_cols_array();

            // Render background
            self.render_background(&mut pass, &matrix_array);

            // Render grid lines
            self.render_grid_lines(&mut pass, &matrix_array);

            // Render text
            self.render_text(&mut pass, &matrix_array);

            // Render cursor (fill and border)
            self.render_cursor(&mut pass, &matrix_array);
        }

        // Reset for headings (need screen space rendering)
        if self.show_headings {
            // Headings render in a separate pass with screen-space matrix
            // For now, skip headings in WebGPU (complex to implement)
            // TODO: Implement headings rendering
        }

        // Submit
        self.gpu.queue().submit(std::iter::once(encoder.finish()));
        output.present();

        // Mark clean
        self.viewport.mark_clean();
        self.content.mark_clean();
        self.headings.mark_clean();

        true
    }

    fn any_visible_hash_dirty(&self) -> bool {
        if self.hashes.is_empty() {
            return false;
        }

        let bounds = self.viewport.visible_bounds();
        let scale = self.viewport.scale();
        let vp_width = self.viewport.width() / scale;
        let vp_height = self.viewport.height() / scale;

        let padding = 100.0;
        let min_x = bounds.left - padding;
        let max_x = bounds.left + vp_width + padding;
        let min_y = bounds.top - padding;
        let max_y = bounds.top + vp_height + padding;

        for hash in self.hashes.values() {
            if hash.intersects_viewport(min_x, max_x, min_y, max_y) && hash.is_dirty() {
                return true;
            }
        }
        false
    }

    fn render_background(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        let bounds = self.viewport.visible_bounds();

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
        let color = [1.0f32, 1.0, 1.0, 1.0]; // White background

        // 6 vertices for 2 triangles (6 floats each: x, y, r, g, b, a)
        let vertices: [f32; 36] = [
            // Triangle 1
            x, y, color[0], color[1], color[2], color[3], x2, y, color[0], color[1], color[2],
            color[3], x2, y2, color[0], color[1], color[2], color[3], // Triangle 2
            x, y, color[0], color[1], color[2], color[3], x2, y2, color[0], color[1], color[2],
            color[3], x, y2, color[0], color[1], color[2], color[3],
        ];

        self.gpu.draw_triangles(pass, &vertices, matrix);
    }

    fn render_grid_lines(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        // Get grid line vertices
        if let Some(line_vertices) = self.content.grid_lines.get_vertices() {
            // Use native GPU line rasterization (LineList topology)
            // This matches WebGL's GL_LINES behavior - always 1 pixel wide,
            // with consistent anti-aliasing regardless of line position.
            self.gpu.draw_lines(pass, line_vertices, matrix);
        }
    }

    fn render_cursor(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        // Get cursor fill vertices (rectangles)
        if let Some(vertices) = self.content.cursor.get_fill_vertices() {
            self.gpu.draw_triangles(pass, vertices, matrix);
        }

        // Get cursor border vertices (lines)
        let scale = self.viewport.scale();
        if let Some(line_vertices) = self.content.cursor.get_border_vertices(scale) {
            // Render cursor border as 2px lines in screen space
            let line_width = 2.0 / scale;
            self.gpu
                .draw_lines_as_triangles(pass, line_vertices, matrix, line_width);
        }
    }

    fn render_text(&mut self, pass: &mut wgpu::RenderPass<'_>, matrix: &[f32; 16]) {
        if self.hashes.is_empty() || !self.fonts_ready() {
            return;
        }

        let scale = self.viewport.scale();

        // Get viewport bounds for culling
        let vp_x = self.viewport.x();
        let vp_y = self.viewport.y();
        let vp_width = self.viewport.width() / scale;
        let vp_height = self.viewport.height() / scale;

        // Viewport bounds with some padding
        let padding = 100.0;
        let min_x = vp_x - padding;
        let max_x = vp_x + vp_width + padding;
        let min_y = vp_y - padding;
        let max_y = vp_y + vp_height + padding;

        // Get text rendering parameters
        let (font_scale, distance_range) = self
            .fonts
            .get("OpenSans")
            .map(|f| {
                let render_size = 14.0;
                (render_size / f.size, f.distance_range)
            })
            .unwrap_or((14.0 / 42.0, 4.0));

        // Render each visible hash's text
        for hash in self.hashes.values_mut() {
            if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
                continue;
            }

            // Rebuild cached vertices if needed
            hash.rebuild_if_dirty(&self.fonts);

            // Render the hash's text
            hash.render_webgpu(
                &mut self.gpu,
                pass,
                matrix,
                scale,
                font_scale,
                distance_range,
            );
        }
    }

    /// Create screen-space matrix
    #[allow(dead_code)]
    fn create_screen_space_matrix(&self, width: f32, height: f32) -> [f32; 16] {
        let sx = 2.0 / width;
        let sy = -2.0 / height;
        let tx = -1.0;
        let ty = 1.0;

        [
            sx, 0.0, 0.0, 0.0, 0.0, sy, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, tx, ty, 0.0, 1.0,
        ]
    }
}
