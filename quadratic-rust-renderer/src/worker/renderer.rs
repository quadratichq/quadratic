//! Worker Renderer
//!
//! The main entry point for browser-based rendering in a web worker.
//! Receives an OffscreenCanvas and handles all rendering.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;
use web_sys::{HtmlImageElement, OffscreenCanvas};

use crate::content::Content;
use crate::headings::GridHeadings;
use crate::render_context::RenderContext;
use crate::text::{
    BitmapFont, BitmapFonts, CellLabel, CellsTextHash, DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH,
    VisibleHashBounds, get_hash_coords, hash_key,
};
use crate::viewport::Viewport;
use crate::webgl::WebGLContext;

/// Worker-based renderer for browser
///
/// This is the main entry point exposed to JavaScript.
/// It owns the WebGL context and handles all rendering.
#[wasm_bindgen]
pub struct WorkerRenderer {
    /// WebGL rendering context
    gl: WebGLContext,

    /// Viewport (camera/zoom/pan state)
    viewport: Viewport,

    /// Renderable content
    content: Content,

    /// Bitmap fonts for text rendering
    fonts: BitmapFonts,

    /// Spatial hashes containing cell labels (15×30 cell regions)
    /// Key is computed from (hash_x, hash_y) coordinates
    hashes: HashMap<u64, CellsTextHash>,

    /// Total label count (cached for stats)
    label_count: usize,

    /// Whether the renderer is running
    running: bool,

    /// Grid headings (column/row headers)
    headings: GridHeadings,

    /// Whether to render headings
    show_headings: bool,
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
        let viewport = Viewport::new(width as f32, height as f32);
        let content = Content::new();

        Ok(Self {
            gl,
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

    /// Start the renderer
    #[wasm_bindgen]
    pub fn start(&mut self) {
        self.running = true;
        log::info!("WorkerRenderer started");
    }

    /// Stop the renderer
    #[wasm_bindgen]
    pub fn stop(&mut self) {
        self.running = false;
        log::info!("WorkerRenderer stopped");
    }

    /// Check if running
    #[wasm_bindgen]
    pub fn is_running(&self) -> bool {
        self.running
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
        self.viewport.resize(width as f32, height as f32, dpr);
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
    /// Takes flat array of [start1, end1, start2, end2, ...] pairs (1-indexed)
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
    /// Takes flat array of [start1, end1, start2, end2, ...] pairs (1-indexed)
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

    /// Set device pixel ratio for headings (affects font size)
    #[wasm_bindgen]
    pub fn set_headings_dpr(&mut self, dpr: f32) {
        self.headings.set_dpr(dpr);
    }

    // =========================================================================
    // Deceleration (momentum scrolling)
    // =========================================================================

    /// Called when drag/pan starts - stops any active deceleration
    #[wasm_bindgen]
    pub fn on_drag_start(&mut self) {
        self.viewport.on_drag_start();
    }

    /// Called during drag/pan - records position for velocity calculation
    /// time: Current time in milliseconds (from performance.now())
    #[wasm_bindgen]
    pub fn on_drag_move(&mut self, time: f64) {
        self.viewport.on_drag_move(time);
    }

    /// Called when drag/pan ends - calculates velocity and starts deceleration
    /// time: Current time in milliseconds
    #[wasm_bindgen]
    pub fn on_drag_end(&mut self, time: f64) {
        self.viewport.on_drag_end(time);
    }

    /// Called on wheel event - stops deceleration
    #[wasm_bindgen]
    pub fn on_wheel_event(&mut self) {
        self.viewport.on_wheel();
    }

    /// Update deceleration and apply velocity to viewport
    /// Call this each frame with elapsed time in milliseconds
    /// Returns true if the viewport was moved
    #[wasm_bindgen]
    pub fn update_decelerate(&mut self, elapsed: f32) -> bool {
        self.viewport.update_decelerate(elapsed)
    }

    /// Check if deceleration or snap-back is currently active
    #[wasm_bindgen]
    pub fn is_decelerating(&self) -> bool {
        self.viewport.is_decelerating() || self.viewport.is_snapping_back()
    }

    /// Manually activate deceleration with a specific velocity
    /// vx, vy: velocity in px/ms
    #[wasm_bindgen]
    pub fn activate_decelerate(&mut self, vx: f32, vy: f32) {
        self.viewport.activate_decelerate(vx, vy);
    }

    /// Reset/stop deceleration
    #[wasm_bindgen]
    pub fn reset_decelerate(&mut self) {
        self.viewport.reset_decelerate();
    }

    // =========================================================================
    // Dirty Flags
    // =========================================================================

    /// Mark the viewport as dirty (forces a render next frame)
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

    /// Check if any component is dirty and needs rendering
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
            .upload_font_texture_from_data(texture_uid, width, height, data)
    }

    /// Add a font from JSON data
    /// Expected format: { font: string, size: number, lineHeight: number, chars: { [charCode: string]: CharData } }
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

    /// Check if fonts are fully ready (metadata loaded AND all textures uploaded)
    fn fonts_ready(&self) -> bool {
        if self.fonts.is_empty() {
            return false;
        }
        // Check that all required texture pages have been uploaded
        for uid in self.fonts.get_required_texture_uids() {
            if !self.gl.has_font_texture(uid) {
                return false;
            }
        }
        true
    }

    /// Add a cell label (text content)
    /// cell_x and cell_y are world coordinates (pixels)
    #[wasm_bindgen]
    pub fn add_label(
        &mut self,
        text: &str,
        cell_x: f32,
        cell_y: f32,
        cell_width: f32,
        cell_height: f32,
    ) {
        // Convert world position to cell coordinates
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
        align: u8,  // 0 = left, 1 = center, 2 = right
        valign: u8, // 0 = top, 1 = middle, 2 = bottom
    ) {
        use crate::text::cell_label::{TextAlign, VerticalAlign};

        // Convert world position to cell coordinates
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

    /// Insert a label into the correct spatial hash
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

    /// Get visible hash bounds for the current viewport
    /// Returns: [min_hash_x, max_hash_x, min_hash_y, max_hash_y]
    /// These bounds include dynamic padding based on viewport scale for preloading
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

    /// Get list of hashes that need to be loaded (visible but not yet loaded)
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
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

    /// Get list of loaded hashes that are outside the visible bounds
    /// These can be unloaded to save memory
    /// Returns: flat array of [hash_x, hash_y, hash_x, hash_y, ...]
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

    /// Remove a hash (for memory management when hash goes offscreen)
    #[wasm_bindgen]
    pub fn remove_hash(&mut self, hash_x: i32, hash_y: i32) {
        let key = hash_key(hash_x as i64, hash_y as i64);
        if let Some(hash) = self.hashes.remove(&key) {
            // Reduce label count by the number of labels in the removed hash
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

    /// Get total sprite cache memory usage in bytes
    #[wasm_bindgen]
    pub fn get_sprite_memory_bytes(&self) -> usize {
        self.hashes
            .values()
            .map(|hash| hash.sprite_memory_bytes())
            .sum()
    }

    /// Get number of active sprite caches
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
    /// elapsed: Time since last frame in milliseconds (for deceleration)
    /// Returns true if a render actually occurred, false if nothing was dirty
    #[wasm_bindgen]
    pub fn frame(&mut self, elapsed: f32) -> bool {
        if !self.running {
            return false;
        }

        // Update deceleration (momentum scrolling) - this may dirty the viewport
        self.viewport.update_decelerate(elapsed);

        // Update content based on viewport
        self.content.update(&self.viewport);

        // Update headings first to get their size
        let (heading_width, heading_height) = if self.show_headings {
            // Use effective_scale because canvas dimensions are in device pixels
            let scale = self.viewport.effective_scale();
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

        // Check if anything is dirty and needs rendering
        let viewport_dirty = self.viewport.dirty;
        let content_dirty = self.content.is_dirty();
        let headings_dirty = self.headings_dirty();
        let hashes_dirty = self.any_visible_hash_dirty();

        let needs_render = viewport_dirty || content_dirty || headings_dirty || hashes_dirty;

        if !needs_render {
            return false;
        }

        // Begin frame (clears command buffer)
        self.gl.begin_frame();

        // Clear with out-of-bounds background color (0xfdfdfd = very light gray)
        // This matches the client's gridBackgroundOutOfBounds color
        let oob_gray = 253.0 / 255.0; // 0xfdfdfd
        self.gl.clear(oob_gray, oob_gray, oob_gray, 1.0);

        // Get the view-projection matrix with heading offset
        let matrix = self
            .viewport
            .view_projection_matrix_with_offset(heading_width, heading_height);
        let matrix_array: [f32; 16] = matrix.to_cols_array();

        // Set viewport to content area (after headings)
        // This makes NDC coordinates map to the content area on screen
        let canvas_width = self.viewport.width() as i32;
        let canvas_height = self.viewport.height() as i32;
        let content_x = heading_width as i32;
        let content_y = heading_height as i32;
        let content_width = canvas_width - heading_width as i32;
        let content_height = canvas_height - heading_height as i32;

        // Set viewport to content area (this is the key fix for proper alignment)
        self.gl.set_viewport(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );

        // Also enable scissor test for content area (for clipping at edges)
        self.gl.set_scissor(
            content_x,
            content_y,
            content_width.max(0),
            content_height.max(0),
        );

        // Render content in z-order (back to front):

        // 1. Background (white grid area)
        self.render_background(&matrix_array);

        // 2. Grid lines
        self.content.grid_lines.render(&mut self.gl, &matrix_array);

        // 3. Cell text
        self.render_text(&matrix_array);

        // 4. Cursor (on top of text)
        // Use effective_scale for pixel-scaled elements (cursor borders)
        let viewport_scale = self.viewport.effective_scale();
        self.content
            .cursor
            .render(&mut self.gl, &matrix_array, viewport_scale);

        // Reset viewport and disable scissor for headings (they render over the full canvas)
        self.gl.reset_viewport();
        self.gl.disable_scissor();

        // Render headings (in screen space, on top of everything)
        if self.show_headings {
            self.render_headings();
        }

        // Execute all buffered draw commands
        self.gl.end_frame();

        // Mark everything as clean after rendering
        self.viewport.mark_clean();
        self.content.mark_clean();
        self.headings.mark_clean();

        true
    }

    /// Check if headings need re-rendering
    fn headings_dirty(&self) -> bool {
        self.headings.is_dirty()
    }

    /// Check if any visible hash needs re-rendering
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

    // =========================================================================
    // Layer Building Methods
    // =========================================================================

    /// Render the background (white grid area)
    fn render_background(&mut self, matrix: &[f32; 16]) {
        use crate::primitives::Rects;

        let bounds = self.viewport.visible_bounds();

        // Only draw if some valid area is visible
        if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
            return;
        }

        // Clamp to valid area (x >= 0, y >= 0)
        let x = bounds.left.max(0.0);
        let y = bounds.top.max(0.0);
        let width = bounds.right - x;
        let height = bounds.bottom - y;

        // White background color (matches client's gridBackground: 0xffffff)
        let mut rects = Rects::new();
        rects.add(x, y, width, height, [1.0, 1.0, 1.0, 1.0]);
        rects.render(&mut self.gl, matrix);
    }

    /// Render cell text using spatial hash culling
    ///
    /// Each visible hash renders its own cached text directly.
    fn render_text(&mut self, matrix: &[f32; 16]) {
        if self.hashes.is_empty() || !self.fonts_ready() {
            return;
        }

        // User-visible scale (for threshold comparisons)
        let scale = self.viewport.scale();
        // Effective scale (for rendering calculations)
        let effective_scale = self.viewport.effective_scale();

        // Get viewport bounds for culling (use visible_bounds which accounts for DPR)
        let bounds = self.viewport.visible_bounds();
        let vp_x = bounds.left;
        let vp_y = bounds.top;
        let vp_width = bounds.width;
        let vp_height = bounds.height;

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

        // Render each visible hash
        for hash in self.hashes.values_mut() {
            if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
                continue;
            }

            // Rebuild mesh cache if dirty
            hash.rebuild_if_dirty(&self.fonts);

            // Rebuild sprite cache if zoomed out (for smooth text at small sizes)
            // Use user-visible scale for threshold comparison
            if scale < crate::text::SPRITE_SCALE_THRESHOLD {
                hash.rebuild_sprite_if_dirty(&self.gl, &self.fonts, font_scale, distance_range);
            }

            // Render this hash's text (switches between MSDF and sprite based on user_scale)
            // Pass user-visible scale for threshold, effective_scale for MSDF fwidth
            hash.render(
                &self.gl,
                matrix,
                scale,           // user-visible scale for threshold comparison
                effective_scale, // effective scale for MSDF rendering
                font_scale,
                distance_range,
            );
        }
    }

    // =========================================================================
    // Headings Rendering
    // =========================================================================

    /// Render grid headings (column and row headers)
    /// Headings are rendered in screen-space
    fn render_headings(&mut self) {
        if !self.fonts_ready() {
            return;
        }

        let canvas_width = self.viewport.width();
        let canvas_height = self.viewport.height();

        // Layout heading labels
        self.headings.layout(&self.fonts);

        // Create screen-space matrix
        let screen_matrix = self.create_screen_space_matrix(canvas_width, canvas_height);

        // Get text params for headings
        let heading_font_size = 10.0 * self.headings.dpr();
        let (font_scale, distance_range) = self
            .fonts
            .get("OpenSans")
            .map(|f| (heading_font_size / f.size, f.distance_range))
            .unwrap_or((heading_font_size / 42.0, 4.0));

        // Render headings directly
        self.headings.render(
            &mut self.gl,
            &screen_matrix,
            &self.fonts,
            font_scale,
            distance_range,
        );
    }

    /// Create a screen-space orthographic projection matrix
    /// Maps (0, 0) at top-left to (width, height) at bottom-right
    fn create_screen_space_matrix(&self, width: f32, height: f32) -> [f32; 16] {
        let sx = 2.0 / width;
        let sy = -2.0 / height; // Negative to flip Y
        let tx = -1.0;
        let ty = 1.0;

        [
            sx, 0.0, 0.0, 0.0, 0.0, sy, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, tx, ty, 0.0, 1.0,
        ]
    }
}
