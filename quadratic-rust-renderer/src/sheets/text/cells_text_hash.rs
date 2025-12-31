//! CellsTextHash - spatial hash for efficient text rendering
//!
//! Groups cells into 15×30 regions for:
//! - Hash-level visibility culling (check hundreds, not millions)
//! - Incremental updates (only rebuild dirty hashes)
//! - Batched mesh caching per hash
//! - Lazy loading: only load hashes within viewport + padding
//! - Sprite caching: pre-render to texture when zoomed out (War and Peace technique)

use std::collections::HashMap;

use quadratic_core_shared::SheetOffsets;

use super::{BitmapFonts, CellLabel, HorizontalLine};

// Shared math utilities (cross-platform)
#[cfg(any(feature = "wasm", feature = "wgpu-wasm", feature = "wgpu-native"))]
use crate::utils::math::ortho_matrix;

// RenderContext trait for has_font_texture method
#[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
use crate::renderers::render_context::RenderContext;

// WASM-only imports (WebGL fallback, JS interop)
#[cfg(feature = "wasm")]
use wasm_bindgen::JsCast;

// WebGL imports (WASM-only fallback)
#[cfg(feature = "wasm")]
use crate::renderers::webgl::RenderTarget;
#[cfg(feature = "wasm")]
use crate::renderers::WebGLContext;

// WebGPU imports (cross-platform via wgpu)
#[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
use crate::renderers::webgpu::RenderTarget as WebGPURenderTarget;
#[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
use crate::renderers::WebGPUContext;

/// Hash dimensions (matches client: CellsTypes.ts)
pub const HASH_WIDTH: i64 = 15; // columns per hash
pub const HASH_HEIGHT: i64 = 30; // rows per hash

/// Cell dimensions in pixels (default)
pub const DEFAULT_CELL_WIDTH: f32 = 100.0;
pub const DEFAULT_CELL_HEIGHT: f32 = 21.0;

/// Base number of hashes to load beyond the visible viewport (for preloading)
pub const HASH_PADDING: i64 = 3;

/// Minimum hash padding - ensures some preloading at all zoom levels
const MIN_HASH_PADDING: i64 = 2;

/// Maximum hash padding to prevent excessive memory usage
const MAX_HASH_PADDING: i64 = 30;

/// Maximum texture pages we support
/// With global texture ID scheme: fontIndex * 16 + localPageId
/// Supporting 4 fonts with up to 16 pages each = 64 max
const MAX_TEXTURE_PAGES: usize = 64;

/// Scale threshold below which we switch from MSDF text to sprite rendering.
/// When viewport_scale < SPRITE_SCALE_THRESHOLD, use the cached sprite.
/// 0.2 means sprite rendering activates when zoomed out to 20% or less.
pub const SPRITE_SCALE_THRESHOLD: f32 = 0.2;

/// Target width for sprite cache texture.
/// We use a fixed medium resolution where MSDF still produces clean output,
/// then rely on texture filtering (with mipmaps) for smaller display sizes.
/// This follows the "War and Peace and WebGL" technique.
const SPRITE_TARGET_WIDTH: u32 = 512;

/// Minimum sprite dimension (don't go too small)
const MIN_SPRITE_DIMENSION: u32 = 64;

/// A spatial hash containing labels for a 15×30 cell region
pub struct CellsTextHash {
    /// Hash coordinates (not pixel coordinates)
    pub hash_x: i64,
    pub hash_y: i64,

    /// Labels indexed by (col, row) within this hash
    labels: HashMap<(i64, i64), CellLabel>,

    /// Whether this hash needs to rebuild its mesh cache
    dirty: bool,

    /// Cached batched vertex data per texture page
    cached_vertices: [Vec<f32>; MAX_TEXTURE_PAGES],
    cached_indices: [Vec<u32>; MAX_TEXTURE_PAGES],

    /// Bounds in world coordinates (for visibility culling)
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Whether the sprite cache needs to be regenerated (shared across all backends)
    sprite_dirty: bool,

    // === Sprite cache for zoomed-out rendering (WebGL - WASM only) ===
    /// Cached sprite render target (pre-rendered text as texture)
    #[cfg(feature = "wasm")]
    sprite_cache: Option<RenderTarget>,

    // === Sprite cache for zoomed-out rendering (WebGPU - cross-platform) ===
    /// Cached sprite render target for WebGPU
    #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
    sprite_cache_webgpu: Option<WebGPURenderTarget>,

    // === Auto-size caches ===
    /// Max content width per column (for column auto-resize)
    /// Key is column index, value is unwrapped text width
    columns_max_cache: HashMap<i64, f32>,

    /// Max content height per row (for row auto-resize)
    /// Key is row index, value is text height with descenders
    rows_max_cache: HashMap<i64, f32>,

    /// Cached horizontal lines (underline/strikethrough) from all labels
    cached_horizontal_lines: Vec<HorizontalLine>,
}

impl CellsTextHash {
    /// Create a new hash for the given hash coordinates
    pub fn new(hash_x: i64, hash_y: i64, offsets: &SheetOffsets) -> Self {
        // Calculate the cell range for this hash (1-indexed)
        let start_col = hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH - 1;
        let start_row = hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT - 1;

        // Get world bounds from offsets
        let (x_start, _) = offsets.column_position_size(start_col);
        let (x_end, width_end) = offsets.column_position_size(end_col);
        let (y_start, _) = offsets.row_position_size(start_row);
        let (y_end, height_end) = offsets.row_position_size(end_row);

        let world_x = x_start as f32;
        let world_y = y_start as f32;
        let world_width = (x_end + width_end - x_start) as f32;
        let world_height = (y_end + height_end - y_start) as f32;

        Self {
            hash_x,
            hash_y,
            labels: HashMap::new(),
            dirty: true,
            cached_vertices: std::array::from_fn(|_| Vec::new()),
            cached_indices: std::array::from_fn(|_| Vec::new()),
            world_x,
            world_y,
            world_width,
            world_height,
            sprite_dirty: true,
            #[cfg(feature = "wasm")]
            sprite_cache: None,
            #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
            sprite_cache_webgpu: None,
            columns_max_cache: HashMap::new(),
            rows_max_cache: HashMap::new(),
            cached_horizontal_lines: Vec::new(),
        }
    }

    /// Update world bounds from sheet offsets (call when offsets change)
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let start_col = self.hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH - 1;
        let start_row = self.hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT - 1;

        let (x_start, _) = offsets.column_position_size(start_col);
        let (x_end, width_end) = offsets.column_position_size(end_col);
        let (y_start, _) = offsets.row_position_size(start_row);
        let (y_end, height_end) = offsets.row_position_size(end_row);

        self.world_x = x_start as f32;
        self.world_y = y_start as f32;
        self.world_width = (x_end + width_end - x_start) as f32;
        self.world_height = (y_end + height_end - y_start) as f32;

        // Mark sprite dirty since bounds changed
        self.sprite_dirty = true;
    }

    /// Add or update a label at the given cell position
    pub fn add_label(&mut self, col: i64, row: i64, label: CellLabel) {
        self.labels.insert((col, row), label);
        self.dirty = true;
        self.sprite_dirty = true;
    }

    /// Remove a label at the given cell position
    pub fn remove_label(&mut self, col: i64, row: i64) -> Option<CellLabel> {
        let result = self.labels.remove(&(col, row));
        if result.is_some() {
            self.dirty = true;
            self.sprite_dirty = true;
        }
        result
    }

    /// Get a label at the given cell position
    pub fn get_label(&self, col: i64, row: i64) -> Option<&CellLabel> {
        self.labels.get(&(col, row))
    }

    /// Get a mutable label at the given cell position
    pub fn get_label_mut(&mut self, col: i64, row: i64) -> Option<&mut CellLabel> {
        self.labels.get_mut(&(col, row))
    }

    /// Check if this hash is empty
    pub fn is_empty(&self) -> bool {
        self.labels.is_empty()
    }

    /// Get the number of labels in this hash
    pub fn label_count(&self) -> usize {
        self.labels.len()
    }

    /// Mark this hash as dirty (needs rebuild)
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
        self.sprite_dirty = true;
    }

    /// Check if this hash is dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Get hash X coordinate
    pub fn hash_x(&self) -> i64 {
        self.hash_x
    }

    /// Get hash Y coordinate
    pub fn hash_y(&self) -> i64 {
        self.hash_y
    }

    /// Get world X position
    pub fn world_x(&self) -> f32 {
        self.world_x
    }

    /// Get world Y position
    pub fn world_y(&self) -> f32 {
        self.world_y
    }

    /// Get world width
    pub fn world_width(&self) -> f32 {
        self.world_width
    }

    /// Get world height
    pub fn world_height(&self) -> f32 {
        self.world_height
    }

    /// Check if the sprite cache is dirty
    pub fn is_sprite_dirty(&self) -> bool {
        self.sprite_dirty
    }

    /// Check if this hash intersects the given viewport bounds
    pub fn intersects_viewport(&self, min_x: f32, max_x: f32, min_y: f32, max_y: f32) -> bool {
        let hash_right = self.world_x + self.world_width;
        let hash_bottom = self.world_y + self.world_height;

        !(hash_right < min_x || self.world_x > max_x || hash_bottom < min_y || self.world_y > max_y)
    }

    /// Rebuild cached mesh data if dirty
    pub fn rebuild_if_dirty(&mut self, fonts: &BitmapFonts) {
        if !self.dirty {
            return;
        }

        // Clear cached data
        for i in 0..MAX_TEXTURE_PAGES {
            self.cached_vertices[i].clear();
            self.cached_indices[i].clear();
        }

        // Clear auto-size caches
        self.columns_max_cache.clear();
        self.rows_max_cache.clear();

        // Clear horizontal lines cache
        self.cached_horizontal_lines.clear();

        // Track vertex offsets per texture page
        let mut vertex_offsets: [u32; MAX_TEXTURE_PAGES] = [0; MAX_TEXTURE_PAGES];

        // Collect meshes from all labels and update auto-size caches
        for label in self.labels.values_mut() {
            // Update auto-size caches from label dimensions
            let col = label.col();
            let row = label.row();
            let width = label.unwrapped_text_width();
            let height = label.text_height_with_descenders();

            // Update max width for this column
            let current_max_width = self.columns_max_cache.entry(col).or_insert(0.0);
            if width > *current_max_width {
                *current_max_width = width;
            }

            // Update max height for this row
            let current_max_height = self.rows_max_cache.entry(row).or_insert(0.0);
            if height > *current_max_height {
                *current_max_height = height;
            }

            let meshes = label.get_meshes(fonts);

            for mesh in meshes {
                if mesh.is_empty() {
                    continue;
                }

                let tex_id = mesh.texture_uid as usize;
                if tex_id >= MAX_TEXTURE_PAGES {
                    continue;
                }

                let mesh_vertices = mesh.get_vertex_data();
                let mesh_indices = mesh.get_index_data();
                let offset = vertex_offsets[tex_id];

                // Add vertices to cache
                self.cached_vertices[tex_id].extend_from_slice(&mesh_vertices);

                // Add indices with offset applied (convert u16 mesh indices to u32)
                for &i in mesh_indices {
                    self.cached_indices[tex_id].push(i as u32 + offset);
                }

                // Update offset (each vertex has 8 floats: x,y,u,v,r,g,b,a)
                vertex_offsets[tex_id] += (mesh_vertices.len() / 8) as u32;
            }

            // Collect horizontal lines (underline/strikethrough)
            let horizontal_lines = label.get_horizontal_lines(fonts);
            self.cached_horizontal_lines
                .extend(horizontal_lines.iter().cloned());
        }

        self.dirty = false;
        // Mesh changed, so sprite cache is now invalid
        self.sprite_dirty = true;
    }

    /// Get cached vertices for a texture page
    pub fn get_cached_vertices(&self, texture_id: usize) -> &[f32] {
        if texture_id < MAX_TEXTURE_PAGES {
            &self.cached_vertices[texture_id]
        } else {
            &[]
        }
    }

    /// Get cached indices for a texture page
    pub fn get_cached_indices(&self, texture_id: usize) -> &[u32] {
        if texture_id < MAX_TEXTURE_PAGES {
            &self.cached_indices[texture_id]
        } else {
            &[]
        }
    }

    /// Check if there's cached data for a texture page
    pub fn has_cached_data(&self, texture_id: usize) -> bool {
        texture_id < MAX_TEXTURE_PAGES && !self.cached_vertices[texture_id].is_empty()
    }

    /// Get cached horizontal lines (underline/strikethrough)
    pub fn get_horizontal_lines(&self) -> &[HorizontalLine] {
        &self.cached_horizontal_lines
    }

    // === Auto-size methods ===

    /// Get max content width for a specific column in this hash
    /// Returns 0.0 if no labels in that column or hash is dirty
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.columns_max_cache.get(&column).copied().unwrap_or(0.0)
    }

    /// Get max content height for a specific row in this hash
    /// Returns 0.0 if no labels in that row or hash is dirty
    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.rows_max_cache.get(&row).copied().unwrap_or(0.0)
    }

    /// Get all row max heights in this hash (for batch operations)
    pub fn get_row_max_heights(&self) -> &HashMap<i64, f32> {
        &self.rows_max_cache
    }

    /// Get all column max widths in this hash (for batch operations)
    pub fn get_column_max_widths(&self) -> &HashMap<i64, f32> {
        &self.columns_max_cache
    }

    /// Render all cached text for this hash using MSDF text rendering (WebGL)
    ///
    /// Renders each texture page's cached text in one draw call per page.
    #[cfg(feature = "wasm")]
    fn render_text(
        &self,
        gl: &WebGLContext,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        for tex_id in 0..MAX_TEXTURE_PAGES {
            if self.cached_vertices[tex_id].is_empty() {
                continue;
            }
            if !gl.has_font_texture(tex_id as u32) {
                continue;
            }

            gl.draw_text(
                &self.cached_vertices[tex_id],
                &self.cached_indices[tex_id],
                tex_id as u32,
                matrix,
                viewport_scale,
                font_scale,
                distance_range,
            );
        }

        // Render horizontal lines (underline/strikethrough)
        self.render_horizontal_lines(gl, matrix);
    }

    /// Render horizontal lines (underline/strikethrough) using WebGL
    #[cfg(feature = "wasm")]
    fn render_horizontal_lines(&self, gl: &WebGLContext, matrix: &[f32; 16]) {
        if self.cached_horizontal_lines.is_empty() {
            return;
        }

        // Convert horizontal lines to triangle vertices
        // Each line becomes 2 triangles (6 vertices), each vertex is 6 floats [x, y, r, g, b, a]
        let mut vertices: Vec<f32> = Vec::with_capacity(self.cached_horizontal_lines.len() * 36);

        for line in &self.cached_horizontal_lines {
            let x1 = line.x;
            let y1 = line.y;
            let x2 = line.x + line.width;
            let y2 = line.y + line.height;
            let [r, g, b, a] = line.color;

            // Triangle 1: top-left, top-right, bottom-right
            vertices.extend_from_slice(&[x1, y1, r, g, b, a]);
            vertices.extend_from_slice(&[x2, y1, r, g, b, a]);
            vertices.extend_from_slice(&[x2, y2, r, g, b, a]);

            // Triangle 2: top-left, bottom-right, bottom-left
            vertices.extend_from_slice(&[x1, y1, r, g, b, a]);
            vertices.extend_from_slice(&[x2, y2, r, g, b, a]);
            vertices.extend_from_slice(&[x1, y2, r, g, b, a]);
        }

        gl.draw_triangles(&vertices, matrix);
    }

    /// Render the cached sprite (pre-rendered texture) for this hash (WebGL)
    #[cfg(feature = "wasm")]
    fn render_sprite(&self, gl: &WebGLContext, matrix: &[f32; 16]) {
        if let Some(ref sprite_cache) = self.sprite_cache {
            gl.draw_sprite_with_texture(
                &sprite_cache.texture,
                self.world_x,
                self.world_y,
                self.world_width,
                self.world_height,
                matrix,
            );
        }
    }

    /// Generate the sprite cache by rendering text to a texture (WebGL)
    ///
    /// This pre-renders all text in this hash to a texture that can be
    /// displayed as a single sprite when zoomed out. Based on the
    /// "War and Peace and WebGL" technique for smooth text at small sizes.
    #[cfg(feature = "wasm")]
    pub fn rebuild_sprite_if_dirty(
        &mut self,
        gl: &WebGLContext,
        fonts: &BitmapFonts,
        font_scale: f32,
        distance_range: f32,
    ) {
        if !self.sprite_dirty {
            return;
        }

        // Don't generate sprite for empty hashes
        if self.labels.is_empty() {
            self.sprite_cache = None;
            self.sprite_dirty = false;
            return;
        }

        // Ensure mesh cache is up to date before rendering to sprite
        self.rebuild_if_dirty(fonts);

        // Calculate sprite texture dimensions at a fixed medium resolution.
        // We use a resolution where MSDF still looks good, then rely on
        // texture filtering + mipmaps for smaller display sizes.
        let aspect_ratio = self.world_height / self.world_width;
        let tex_width = SPRITE_TARGET_WIDTH;
        let tex_height =
            ((SPRITE_TARGET_WIDTH as f32 * aspect_ratio) as u32).max(MIN_SPRITE_DIMENSION);

        // Create or recreate render target if needed
        let needs_new_target = match &self.sprite_cache {
            Some(cache) => cache.width != tex_width || cache.height != tex_height,
            None => true,
        };

        if needs_new_target {
            // Delete old render target if it exists
            if let Some(old_cache) = self.sprite_cache.take() {
                old_cache.delete(gl.gl());
            }

            // Create new render target with mipmap support
            match RenderTarget::new_with_mipmaps(gl.gl(), tex_width, tex_height) {
                Ok(target) => {
                    self.sprite_cache = Some(target);
                }
                Err(e) => {
                    log::warn!("Failed to create sprite cache: {:?}", e);
                    self.sprite_dirty = false;
                    return;
                }
            }
        }

        let sprite_cache = self.sprite_cache.as_ref().unwrap();

        // Save current WebGL state that we'll modify
        // Save viewport
        let mut saved_viewport = [0i32; 4];
        gl.gl()
            .get_parameter(web_sys::WebGl2RenderingContext::VIEWPORT)
            .ok()
            .and_then(|v| v.dyn_into::<js_sys::Int32Array>().ok())
            .map(|arr| arr.copy_to(&mut saved_viewport));

        // Save and disable scissor test - the main render loop may have it enabled
        // which would incorrectly clip our framebuffer rendering
        let scissor_enabled = gl
            .gl()
            .is_enabled(web_sys::WebGl2RenderingContext::SCISSOR_TEST);
        if scissor_enabled {
            gl.gl()
                .disable(web_sys::WebGl2RenderingContext::SCISSOR_TEST);
        }

        // Clear the render target with transparent background and bind it
        sprite_cache.clear(gl.gl());
        sprite_cache.bind(gl.gl());

        // Use separate blend functions for RGB and Alpha when rendering to framebuffer.
        // RGB: (SRC_ALPHA, ONE_MINUS_SRC_ALPHA) → premultiplied RGB
        // Alpha: (ONE, ONE_MINUS_SRC_ALPHA) → correct alpha (not squared)
        // Without this, alpha gets squared (a*a instead of a) causing lighter colors.
        gl.gl().blend_func_separate(
            web_sys::WebGl2RenderingContext::SRC_ALPHA,
            web_sys::WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            web_sys::WebGl2RenderingContext::ONE,
            web_sys::WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        // Create orthographic matrix that maps world coords to the render target
        // The render target covers (world_x, world_y) to (world_x + world_width, world_y + world_height)
        let ortho = ortho_matrix(
            self.world_x,
            self.world_x + self.world_width,
            self.world_y + self.world_height, // bottom (flipped for texture coords)
            self.world_y,                     // top
        );

        // Calculate the effective scale for MSDF rendering.
        // The sprite texture is smaller than world coordinates, so we need to
        // tell MSDF the correct scale for proper anti-aliasing.
        let sprite_scale = tex_width as f32 / self.world_width;

        // Render text to the render target with correct MSDF scale
        self.render_text(gl, &ortho, sprite_scale, font_scale, distance_range);

        // Generate mipmaps for smooth scaling at very small sizes
        sprite_cache.generate_mipmaps(gl.gl());

        // Unbind render target (return to default framebuffer)
        gl.gl()
            .bind_framebuffer(web_sys::WebGl2RenderingContext::FRAMEBUFFER, None);

        // Restore standard blend function (not separate)
        gl.gl().blend_func(
            web_sys::WebGl2RenderingContext::SRC_ALPHA,
            web_sys::WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        // Restore viewport to what it was before
        gl.gl().viewport(
            saved_viewport[0],
            saved_viewport[1],
            saved_viewport[2],
            saved_viewport[3],
        );

        // Restore scissor test state
        if scissor_enabled {
            gl.gl()
                .enable(web_sys::WebGl2RenderingContext::SCISSOR_TEST);
        }

        self.sprite_dirty = false;
    }

    /// Render text using WebGL
    ///
    /// Uses MSDF text rendering when zoomed in (user_scale >= SPRITE_SCALE_THRESHOLD)
    /// and pre-rendered sprite when zoomed out (user_scale < SPRITE_SCALE_THRESHOLD).
    ///
    /// Note: Call `rebuild_sprite_if_dirty` before this method if the scale is
    /// below SPRITE_SCALE_THRESHOLD to ensure the sprite cache is up to date.
    ///
    /// # Arguments
    /// * `gl` - WebGL context
    /// * `matrix` - View-projection matrix
    /// * `user_scale` - User-visible zoom level (for threshold comparison)
    /// * `effective_scale` - Rendering scale including DPR (for MSDF fwidth calculation)
    /// * `font_scale` - Font scale factor
    /// * `distance_range` - MSDF distance range
    #[cfg(feature = "wasm")]
    pub fn render(
        &self,
        gl: &WebGLContext,
        matrix: &[f32; 16],
        user_scale: f32,
        effective_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        if self.labels.is_empty() {
            return;
        }

        if user_scale >= SPRITE_SCALE_THRESHOLD {
            // Zoomed in: use MSDF text rendering for sharp glyphs
            self.render_text(gl, matrix, effective_scale, font_scale, distance_range);
        } else {
            // Zoomed out: use pre-rendered sprite for smooth appearance
            self.render_sprite(gl, matrix);
        }
    }

    /// Render text using WebGPU (cross-platform via wgpu)
    ///
    /// Uses MSDF text rendering when zoomed in (user_scale >= SPRITE_SCALE_THRESHOLD)
    /// and pre-rendered sprite when zoomed out (user_scale < SPRITE_SCALE_THRESHOLD).
    ///
    /// # Arguments
    /// * `gpu` - WebGPU context
    /// * `pass` - Render pass
    /// * `matrix` - View-projection matrix
    /// * `user_scale` - User-visible zoom level (for threshold comparison)
    /// * `effective_scale` - Rendering scale including DPR (for MSDF fwidth calculation)
    /// * `font_scale` - Font scale factor
    /// * `distance_range` - MSDF distance range
    #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
    pub fn render_webgpu(
        &self,
        gpu: &mut WebGPUContext,
        pass: &mut wgpu::RenderPass<'_>,
        matrix: &[f32; 16],
        user_scale: f32,
        effective_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        if self.labels.is_empty() {
            return;
        }

        if user_scale >= SPRITE_SCALE_THRESHOLD {
            // Zoomed in: use MSDF text rendering for sharp glyphs
            self.render_text_webgpu(
                gpu,
                pass,
                matrix,
                effective_scale,
                font_scale,
                distance_range,
            );
        } else {
            // Zoomed out: use pre-rendered sprite for smooth appearance
            if let Some(ref sprite_cache) = self.sprite_cache_webgpu {
                gpu.draw_sprite_texture(
                    pass,
                    &sprite_cache.view,
                    self.world_x,
                    self.world_y,
                    self.world_width,
                    self.world_height,
                    matrix,
                );
            } else {
                // Fallback to MSDF if sprite cache not ready
                self.render_text_webgpu(
                    gpu,
                    pass,
                    matrix,
                    effective_scale,
                    font_scale,
                    distance_range,
                );
            }
        }
    }

    /// Render text glyphs using MSDF (WebGPU - cross-platform via wgpu)
    #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
    fn render_text_webgpu(
        &self,
        gpu: &mut WebGPUContext,
        pass: &mut wgpu::RenderPass<'_>,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        for tex_id in 0..MAX_TEXTURE_PAGES {
            if self.cached_vertices[tex_id].is_empty() {
                continue;
            }
            if !gpu.has_font_texture(tex_id as u32) {
                continue;
            }

            gpu.draw_text(
                pass,
                &self.cached_vertices[tex_id],
                &self.cached_indices[tex_id],
                tex_id as u32,
                matrix,
                viewport_scale,
                font_scale,
                distance_range,
            );
        }

        // Render horizontal lines (underline/strikethrough)
        self.render_horizontal_lines_webgpu(gpu, pass, matrix);
    }

    /// Render horizontal lines (underline/strikethrough) using WebGPU
    #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
    fn render_horizontal_lines_webgpu(
        &self,
        gpu: &mut WebGPUContext,
        pass: &mut wgpu::RenderPass<'_>,
        matrix: &[f32; 16],
    ) {
        if self.cached_horizontal_lines.is_empty() {
            return;
        }

        // Convert horizontal lines to triangle vertices
        // Each line becomes 2 triangles (6 vertices), each vertex is 6 floats [x, y, r, g, b, a]
        let mut vertices: Vec<f32> = Vec::with_capacity(self.cached_horizontal_lines.len() * 36);

        for line in &self.cached_horizontal_lines {
            let x1 = line.x;
            let y1 = line.y;
            let x2 = line.x + line.width;
            let y2 = line.y + line.height;
            let [r, g, b, a] = line.color;

            // Triangle 1: top-left, top-right, bottom-right
            vertices.extend_from_slice(&[x1, y1, r, g, b, a]);
            vertices.extend_from_slice(&[x2, y1, r, g, b, a]);
            vertices.extend_from_slice(&[x2, y2, r, g, b, a]);

            // Triangle 2: top-left, bottom-right, bottom-left
            vertices.extend_from_slice(&[x1, y1, r, g, b, a]);
            vertices.extend_from_slice(&[x2, y2, r, g, b, a]);
            vertices.extend_from_slice(&[x1, y2, r, g, b, a]);
        }

        gpu.draw_triangles(pass, &vertices, matrix);
    }

    /// Rebuild sprite cache for WebGPU if dirty (cross-platform via wgpu)
    ///
    /// This pre-renders all text in this hash to a texture that can be
    /// displayed as a single sprite when zoomed out.
    #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
    pub fn rebuild_sprite_if_dirty_webgpu(
        &mut self,
        gpu: &mut WebGPUContext,
        fonts: &BitmapFonts,
        font_scale: f32,
        distance_range: f32,
    ) {
        if !self.sprite_dirty {
            return;
        }

        // Don't generate sprite for empty hashes
        if self.labels.is_empty() {
            self.sprite_cache_webgpu = None;
            self.sprite_dirty = false;
            return;
        }

        // Ensure mesh cache is up to date before rendering to sprite
        self.rebuild_if_dirty(fonts);

        // Calculate sprite dimensions based on aspect ratio
        let aspect_ratio = self.world_height / self.world_width;
        let tex_width = SPRITE_TARGET_WIDTH;
        let tex_height =
            ((SPRITE_TARGET_WIDTH as f32 * aspect_ratio) as u32).max(MIN_SPRITE_DIMENSION);

        // Create or recreate render target if needed
        let needs_new_target = match &self.sprite_cache_webgpu {
            Some(cache) => cache.width != tex_width || cache.height != tex_height,
            None => true,
        };

        if needs_new_target {
            // Use mipmapped render target for smooth scaling at small sizes
            self.sprite_cache_webgpu = Some(WebGPURenderTarget::new_with_mipmaps(
                gpu.device(),
                tex_width,
                tex_height,
            ));
        }

        let sprite_cache = self.sprite_cache_webgpu.as_ref().unwrap();

        // Create orthographic projection for the sprite (world coords -> sprite texture coords)
        let sprite_scale = tex_width as f32 / self.world_width;
        let ortho = ortho_matrix(
            self.world_x,
            self.world_x + self.world_width,
            self.world_y + self.world_height,
            self.world_y,
        );

        // Create a command encoder for rendering to the sprite texture
        let mut encoder = gpu
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Sprite Cache Encoder"),
            });

        {
            let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Sprite Cache Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &sprite_cache.render_view, // Use render_view (single mip level) for rendering
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Set viewport to match sprite texture dimensions
            render_pass.set_viewport(0.0, 0.0, tex_width as f32, tex_height as f32, 0.0, 1.0);

            // Render text to the sprite texture
            self.render_text_webgpu(
                gpu,
                &mut render_pass,
                &ortho,
                sprite_scale,
                font_scale,
                distance_range,
            );
        }

        // Submit the render commands
        gpu.queue().submit(std::iter::once(encoder.finish()));

        // Generate mipmaps for smooth scaling at small sizes
        gpu.generate_mipmaps(sprite_cache);

        self.sprite_dirty = false;
    }

    /// Check if this hash has a valid sprite cache (WebGL or WebGPU)
    pub fn has_sprite_cache(&self) -> bool {
        #[cfg(feature = "wasm")]
        let has_webgl = self.sprite_cache.is_some();
        #[cfg(not(feature = "wasm"))]
        let has_webgl = false;

        #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
        let has_webgpu = self.sprite_cache_webgpu.is_some();
        #[cfg(not(any(feature = "wgpu-wasm", feature = "wgpu-native")))]
        let has_webgpu = false;

        has_webgl || has_webgpu
    }

    /// Delete the sprite cache to free GPU memory (WebGL)
    #[cfg(feature = "wasm")]
    pub fn delete_sprite_cache(&mut self, gl: &WebGLContext) {
        if let Some(cache) = self.sprite_cache.take() {
            cache.delete(gl.gl());
        }
        self.sprite_dirty = true;
    }

    /// Get the memory usage of the sprite cache in bytes
    /// Returns 0 if no sprite cache exists
    /// Checks both WebGL and WebGPU sprite caches
    pub fn sprite_memory_bytes(&self) -> usize {
        // WebGL sprite cache
        #[cfg(feature = "wasm")]
        let webgl_bytes = match &self.sprite_cache {
            Some(cache) => {
                // RGBA texture: 4 bytes per pixel
                // With mipmaps: roughly 1.33x the base size (1 + 1/4 + 1/16 + ...)
                let base_size = (cache.width * cache.height * 4) as usize;
                (base_size as f32 * 1.33) as usize
            }
            None => 0,
        };
        #[cfg(not(feature = "wasm"))]
        let webgl_bytes = 0;

        // WebGPU sprite cache
        #[cfg(any(feature = "wgpu-wasm", feature = "wgpu-native"))]
        let webgpu_bytes = match &self.sprite_cache_webgpu {
            Some(cache) => {
                // RGBA texture: 4 bytes per pixel
                // With mipmaps: roughly 1.33x the base size
                let base_size = (cache.width * cache.height * 4) as usize;
                (base_size as f32 * 1.33) as usize
            }
            None => 0,
        };
        #[cfg(not(any(feature = "wgpu-wasm", feature = "wgpu-native")))]
        let webgpu_bytes = 0;

        webgl_bytes + webgpu_bytes
    }
}

/// Get hash coordinates for a cell position
/// Get hash coordinates for a cell position (1-indexed columns/rows)
pub fn get_hash_coords(col: i64, row: i64) -> (i64, i64) {
    // Adjust for 1-indexed: col 1-15 → hash 0, col 16-30 → hash 1, etc.
    (
        (col - 1).div_euclid(HASH_WIDTH),
        (row - 1).div_euclid(HASH_HEIGHT),
    )
}

/// Get hash key from hash coordinates
pub fn hash_key(hash_x: i64, hash_y: i64) -> u64 {
    // Combine hash coordinates into a single key
    // Using bit manipulation to support negative coordinates
    let x_bits = (hash_x as i32) as u32;
    let y_bits = (hash_y as i32) as u32;
    ((x_bits as u64) << 32) | (y_bits as u64)
}

/// Represents the range of visible hashes (inclusive bounds)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VisibleHashBounds {
    pub min_hash_x: i64,
    pub max_hash_x: i64,
    pub min_hash_y: i64,
    pub max_hash_y: i64,
}

impl VisibleHashBounds {
    /// Create bounds from viewport world coordinates using sheet offsets
    /// Includes dynamic padding based on viewport scale for preloading.
    /// When zoomed out (scale < 1), more hashes are included in the padding
    /// to ensure smooth scrolling at lower zoom levels.
    pub fn from_viewport(
        vp_x: f32,
        vp_y: f32,
        vp_width: f32,
        vp_height: f32,
        viewport_scale: f32,
        offsets: &SheetOffsets,
    ) -> Self {
        // Convert world coordinates to cell coordinates using offsets
        let (min_col, _) = offsets.column_from_x(vp_x.max(0.0) as f64);
        let (max_col, _) = offsets.column_from_x((vp_x + vp_width).max(0.0) as f64);
        let (min_row, _) = offsets.row_from_y(vp_y.max(0.0) as f64);
        let (max_row, _) = offsets.row_from_y((vp_y + vp_height).max(0.0) as f64);

        // Convert to hash coordinates and add padding
        let (min_hash_x, min_hash_y) = get_hash_coords(min_col, min_row);
        let (max_hash_x, max_hash_y) = get_hash_coords(max_col, max_row);

        // Calculate dynamic padding based on viewport scale.
        //
        // At HIGH zoom (scale > 1): Need more padding because you scroll through
        // hashes quickly in world coordinates. Scale UP padding with zoom.
        //
        // At LOW zoom (scale < 1): Need more padding because more hashes are
        // visible on screen. Scale UP padding inversely with zoom.
        //
        // Formula: max(base * scale, base / scale) - covers both cases
        let scale_clamped = viewport_scale.clamp(0.1, 10.0);
        let high_zoom_padding = (HASH_PADDING as f32 * scale_clamped).ceil() as i64;
        let low_zoom_padding = (HASH_PADDING as f32 / scale_clamped).ceil() as i64;
        let dynamic_padding = high_zoom_padding
            .max(low_zoom_padding)
            .max(MIN_HASH_PADDING)
            .min(MAX_HASH_PADDING);

        Self {
            min_hash_x: min_hash_x - dynamic_padding,
            max_hash_x: max_hash_x + dynamic_padding,
            min_hash_y: min_hash_y - dynamic_padding,
            max_hash_y: max_hash_y + dynamic_padding,
        }
    }

    /// Check if a hash coordinate is within bounds
    pub fn contains(&self, hash_x: i64, hash_y: i64) -> bool {
        hash_x >= self.min_hash_x
            && hash_x <= self.max_hash_x
            && hash_y >= self.min_hash_y
            && hash_y <= self.max_hash_y
    }

    /// Iterate over all hash coordinates in bounds
    pub fn iter(&self) -> impl Iterator<Item = (i64, i64)> + '_ {
        (self.min_hash_y..=self.max_hash_y)
            .flat_map(move |y| (self.min_hash_x..=self.max_hash_x).map(move |x| (x, y)))
    }

    /// Get the number of hashes in bounds
    pub fn count(&self) -> usize {
        let width = (self.max_hash_x - self.min_hash_x + 1).max(0) as usize;
        let height = (self.max_hash_y - self.min_hash_y + 1).max(0) as usize;
        width * height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_hash_coords() {
        // 1-indexed coordinates: cols 1-15 → hash 0, cols 16-30 → hash 1
        assert_eq!(get_hash_coords(1, 1), (0, 0));
        assert_eq!(get_hash_coords(15, 30), (0, 0));
        assert_eq!(get_hash_coords(16, 31), (1, 1));
        assert_eq!(get_hash_coords(31, 61), (2, 2));

        // Edge cases for 1-indexed
        assert_eq!(get_hash_coords(0, 0), (-1, -1)); // col 0 is before col 1
        assert_eq!(get_hash_coords(-14, -29), (-1, -1));
        assert_eq!(get_hash_coords(-15, -30), (-2, -2));
    }

    #[test]
    fn test_intersects_viewport() {
        let offsets = SheetOffsets::default();
        let hash = CellsTextHash::new(0, 0, &offsets);

        // Hash at (0,0) covers world coords (0,0) to (1500, 630)
        assert!(hash.intersects_viewport(0.0, 100.0, 0.0, 100.0));
        assert!(hash.intersects_viewport(-100.0, 100.0, -100.0, 100.0));
        assert!(!hash.intersects_viewport(2000.0, 3000.0, 0.0, 100.0));
    }
}
