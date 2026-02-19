//! Viewport - manages camera position and zoom
//!
//! This is a read-only view of the viewport state. The actual state is controlled
//! by the client (TypeScript) via SharedArrayBuffer in the browser, or set directly
//! in native rendering contexts.

use glam::{Mat4, Vec2};

use super::bounds::{VisibleBounds, VisibleHashBounds};
use crate::constants::{HASH_HEIGHT, HASH_PADDING, HASH_WIDTH};

/// Represents the visible region of the infinite grid
///
/// The viewport contains the camera position, zoom level, and size.
/// All coordinate conversions and matrix calculations are handled here.
#[derive(Debug, Clone)]
pub struct Viewport {
    /// Position of the viewport in world coordinates
    position: Vec2,

    /// Scale factor (zoom level)
    scale: f32,

    /// Device pixel ratio (for high-DPI displays)
    pub dpr: f32,

    /// Size of the viewport in device pixels
    size: Vec2,

    /// Whether the viewport has changed and needs re-rendering
    pub dirty: bool,

    /// Minimum allowed scale (for clamping)
    min_scale: f32,

    /// Maximum allowed scale (for clamping)
    max_scale: f32,
}

impl Viewport {
    /// Create a new viewport with default dimensions
    pub fn new() -> Self {
        Self::with_size(800.0, 600.0)
    }

    /// Create a new viewport with the given dimensions
    pub fn with_size(width: f32, height: f32) -> Self {
        Self {
            position: Vec2::ZERO,
            scale: 1.0,
            dpr: 1.0,
            size: Vec2::new(width, height),
            dirty: true,
            min_scale: 0.01,
            max_scale: 10.0,
        }
    }

    // =========================================================================
    // State Setters
    // =========================================================================

    /// Resize the viewport with device pixel ratio
    ///
    /// # Arguments
    /// * `width` - Width in device pixels
    /// * `height` - Height in device pixels
    /// * `dpr` - Device pixel ratio (e.g., 2.0 for Retina displays)
    pub fn resize(&mut self, width: f32, height: f32, dpr: f32) {
        if (self.size.x - width).abs() > 0.001
            || (self.size.y - height).abs() > 0.001
            || (self.dpr - dpr).abs() > 0.001
        {
            self.size = Vec2::new(width, height);
            self.dpr = dpr;
            self.dirty = true;
        }
    }

    /// Set the viewport position directly
    pub fn set_position(&mut self, x: f32, y: f32) {
        if (self.position.x - x).abs() > 0.001 || (self.position.y - y).abs() > 0.001 {
            self.position = Vec2::new(x, y);
            self.dirty = true;
        }
    }

    /// Set the scale directly
    pub fn set_scale(&mut self, scale: f32) {
        let clamped = scale.clamp(self.min_scale, self.max_scale);
        if (self.scale - clamped).abs() > 0.0001 {
            self.scale = clamped;
            self.dirty = true;
        }
    }

    /// Set position and scale together
    pub fn set_viewport(&mut self, x: f32, y: f32, scale: f32) {
        self.set_position(x, y);
        self.set_scale(scale);
    }

    /// Mark the viewport as clean (after rendering)
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Mark the viewport as dirty (needs re-rendering)
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    // =========================================================================
    // State Getters
    // =========================================================================

    /// Get the device pixel ratio
    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    /// Get the current user-visible scale (zoom level)
    pub fn scale(&self) -> f32 {
        self.scale
    }

    /// Get the effective rendering scale (scale * dpr)
    pub fn effective_scale(&self) -> f32 {
        self.scale * self.dpr
    }

    /// Get the X position
    pub fn x(&self) -> f32 {
        self.position.x
    }

    /// Get the Y position
    pub fn y(&self) -> f32 {
        self.position.y
    }

    /// Get the viewport size
    pub fn size(&self) -> Vec2 {
        self.size
    }

    /// Get the viewport width in screen pixels
    pub fn width(&self) -> f32 {
        self.size.x
    }

    /// Get the viewport height in screen pixels
    pub fn height(&self) -> f32 {
        self.size.y
    }

    /// Check if viewport is dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    // =========================================================================
    // Coordinate Conversion
    // =========================================================================

    /// Convert screen coordinates (device pixels) to world coordinates
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> Vec2 {
        let effective_scale = self.scale * self.dpr;
        Vec2::new(
            self.position.x + screen_x / effective_scale,
            self.position.y + screen_y / effective_scale,
        )
    }

    /// Convert world coordinates to screen coordinates (device pixels)
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> Vec2 {
        let effective_scale = self.scale * self.dpr;
        Vec2::new(
            (world_x - self.position.x) * effective_scale,
            (world_y - self.position.y) * effective_scale,
        )
    }

    // =========================================================================
    // Bounds Calculations
    // =========================================================================

    /// Get the visible bounds in world coordinates
    pub fn visible_bounds(&self) -> VisibleBounds {
        let top_left = self.screen_to_world(0.0, 0.0);
        let bottom_right = self.screen_to_world(self.size.x, self.size.y);

        VisibleBounds {
            left: top_left.x,
            top: top_left.y,
            right: bottom_right.x,
            bottom: bottom_right.y,
            width: bottom_right.x - top_left.x,
            height: bottom_right.y - top_left.y,
        }
    }

    /// Get the visible hash bounds for the current viewport
    pub fn visible_hash_bounds(
        &self,
        offsets: &quadratic_core::sheet_offsets::SheetOffsets,
    ) -> VisibleHashBounds {
        let bounds = self.visible_bounds();

        // Convert world coordinates to cell coordinates using offsets
        let (min_col, _) = offsets.column_from_x(bounds.left.max(0.0) as f64);
        let (max_col, _) = offsets.column_from_x(bounds.right.max(0.0) as f64);
        let (min_row, _) = offsets.row_from_y(bounds.top.max(0.0) as f64);
        let (max_row, _) = offsets.row_from_y(bounds.bottom.max(0.0) as f64);

        // Convert to hash coordinates
        let min_hash_x = (min_col - 1).div_euclid(HASH_WIDTH);
        let max_hash_x = (max_col - 1).div_euclid(HASH_WIDTH);
        let min_hash_y = (min_row - 1).div_euclid(HASH_HEIGHT);
        let max_hash_y = (max_row - 1).div_euclid(HASH_HEIGHT);

        VisibleHashBounds {
            min_hash_x: min_hash_x - HASH_PADDING,
            max_hash_x: max_hash_x + HASH_PADDING,
            min_hash_y: min_hash_y - HASH_PADDING,
            max_hash_y: max_hash_y + HASH_PADDING,
        }
    }

    // =========================================================================
    // Rendering Helpers
    // =========================================================================

    /// Get the view-projection matrix for rendering
    pub fn view_projection_matrix(&self) -> Mat4 {
        self.view_projection_matrix_with_offset(0.0, 0.0)
    }

    /// Get the view-projection matrix with an offset for headings
    /// offset_x: horizontal offset in device pixels (e.g., row header width)
    /// offset_y: vertical offset in device pixels (e.g., column header height)
    pub fn view_projection_matrix_with_offset(&self, offset_x: f32, offset_y: f32) -> Mat4 {
        let content_width = self.size.x - offset_x;
        let content_height = self.size.y - offset_y;
        let effective_scale = self.scale * self.dpr;

        // Add a small margin in device pixels for cursor outlines
        let margin_pixels = 2.0;
        let margin_world = margin_pixels / effective_scale;

        // Orthographic projection for 2D
        let projection = Mat4::orthographic_rh(0.0, content_width, content_height, 0.0, -1.0, 1.0);

        // View matrix (camera transform)
        let view = Mat4::from_scale_rotation_translation(
            glam::Vec3::new(effective_scale, effective_scale, 1.0),
            glam::Quat::IDENTITY,
            glam::Vec3::new(
                (-self.position.x + margin_world) * effective_scale,
                (-self.position.y + margin_world) * effective_scale,
                0.0,
            ),
        );

        projection * view
    }
}

impl Default for Viewport {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_viewport() {
        let vp = Viewport::new();
        assert_eq!(vp.width(), 800.0);
        assert_eq!(vp.height(), 600.0);
        assert_eq!(vp.scale(), 1.0);
        assert_eq!(vp.x(), 0.0);
        assert_eq!(vp.y(), 0.0);
        assert!(vp.is_dirty());
    }

    #[test]
    fn test_viewport_with_size() {
        let vp = Viewport::with_size(1920.0, 1080.0);
        assert_eq!(vp.width(), 1920.0);
        assert_eq!(vp.height(), 1080.0);
    }

    #[test]
    fn test_set_position() {
        let mut vp = Viewport::new();
        vp.mark_clean();
        assert!(!vp.is_dirty());

        vp.set_position(100.0, 200.0);
        assert_eq!(vp.x(), 100.0);
        assert_eq!(vp.y(), 200.0);
        assert!(vp.is_dirty());
    }

    #[test]
    fn test_set_position_no_change() {
        let mut vp = Viewport::new();
        vp.set_position(100.0, 200.0);
        vp.mark_clean();

        // Setting same position should not dirty
        vp.set_position(100.0, 200.0);
        assert!(!vp.is_dirty());
    }

    #[test]
    fn test_set_scale() {
        let mut vp = Viewport::new();
        vp.mark_clean();

        vp.set_scale(2.0);
        assert_eq!(vp.scale(), 2.0);
        assert!(vp.is_dirty());
    }

    #[test]
    fn test_scale_clamping_min() {
        let mut vp = Viewport::new();
        vp.set_scale(0.001); // Below min_scale of 0.01
        assert_eq!(vp.scale(), 0.01);
    }

    #[test]
    fn test_scale_clamping_max() {
        let mut vp = Viewport::new();
        vp.set_scale(100.0); // Above max_scale of 10.0
        assert_eq!(vp.scale(), 10.0);
    }

    #[test]
    fn test_resize() {
        let mut vp = Viewport::new();
        vp.mark_clean();

        vp.resize(1024.0, 768.0, 2.0);
        assert_eq!(vp.width(), 1024.0);
        assert_eq!(vp.height(), 768.0);
        assert_eq!(vp.dpr(), 2.0);
        assert!(vp.is_dirty());
    }

    #[test]
    fn test_resize_no_change() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.mark_clean();

        // Resizing to same dimensions should not dirty
        vp.resize(800.0, 600.0, 1.0);
        assert!(!vp.is_dirty());
    }

    #[test]
    fn test_effective_scale() {
        let mut vp = Viewport::new();
        vp.set_scale(2.0);
        vp.resize(800.0, 600.0, 2.0); // dpr = 2.0

        assert_eq!(vp.effective_scale(), 4.0); // 2.0 * 2.0
    }

    #[test]
    fn test_screen_to_world_identity() {
        let vp = Viewport::with_size(800.0, 600.0);
        // At scale=1, dpr=1, position=0: screen coords = world coords
        let world = vp.screen_to_world(100.0, 200.0);
        assert_eq!(world, Vec2::new(100.0, 200.0));
    }

    #[test]
    fn test_screen_to_world_with_offset() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.set_position(50.0, 100.0);

        let world = vp.screen_to_world(100.0, 100.0);
        assert_eq!(world, Vec2::new(150.0, 200.0));
    }

    #[test]
    fn test_screen_to_world_with_scale() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.set_scale(2.0);

        // At scale=2: screen 100px = 50 world units
        let world = vp.screen_to_world(100.0, 100.0);
        assert_eq!(world, Vec2::new(50.0, 50.0));
    }

    #[test]
    fn test_screen_to_world_with_dpr() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.resize(800.0, 600.0, 2.0);

        // At dpr=2: screen 100px (device pixels) = 50 world units
        let world = vp.screen_to_world(100.0, 100.0);
        assert_eq!(world, Vec2::new(50.0, 50.0));
    }

    #[test]
    fn test_world_to_screen_identity() {
        let vp = Viewport::with_size(800.0, 600.0);
        let screen = vp.world_to_screen(100.0, 200.0);
        assert_eq!(screen, Vec2::new(100.0, 200.0));
    }

    #[test]
    fn test_world_to_screen_with_offset() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.set_position(50.0, 100.0);

        let screen = vp.world_to_screen(150.0, 200.0);
        assert_eq!(screen, Vec2::new(100.0, 100.0));
    }

    #[test]
    fn test_world_to_screen_with_scale() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.set_scale(2.0);

        // At scale=2: 50 world units = 100 screen px
        let screen = vp.world_to_screen(50.0, 50.0);
        assert_eq!(screen, Vec2::new(100.0, 100.0));
    }

    #[test]
    fn test_screen_world_roundtrip() {
        let mut vp = Viewport::with_size(1024.0, 768.0);
        vp.set_position(123.0, 456.0);
        vp.set_scale(1.5);
        vp.resize(1024.0, 768.0, 2.0);

        let original = Vec2::new(500.0, 300.0);
        let screen = vp.world_to_screen(original.x, original.y);
        let world = vp.screen_to_world(screen.x, screen.y);

        assert!((original.x - world.x).abs() < 0.001);
        assert!((original.y - world.y).abs() < 0.001);
    }

    #[test]
    fn test_visible_bounds() {
        let vp = Viewport::with_size(800.0, 600.0);
        let bounds = vp.visible_bounds();

        assert_eq!(bounds.left, 0.0);
        assert_eq!(bounds.top, 0.0);
        assert_eq!(bounds.right, 800.0);
        assert_eq!(bounds.bottom, 600.0);
        assert_eq!(bounds.width, 800.0);
        assert_eq!(bounds.height, 600.0);
    }

    #[test]
    fn test_visible_bounds_with_offset() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.set_position(100.0, 50.0);
        let bounds = vp.visible_bounds();

        assert_eq!(bounds.left, 100.0);
        assert_eq!(bounds.top, 50.0);
        assert_eq!(bounds.right, 900.0);
        assert_eq!(bounds.bottom, 650.0);
    }

    #[test]
    fn test_visible_bounds_with_scale() {
        let mut vp = Viewport::with_size(800.0, 600.0);
        vp.set_scale(2.0);
        let bounds = vp.visible_bounds();

        // At scale=2: viewport shows half the world distance
        assert_eq!(bounds.width, 400.0);
        assert_eq!(bounds.height, 300.0);
    }

    #[test]
    fn test_set_viewport() {
        let mut vp = Viewport::new();
        vp.mark_clean();

        vp.set_viewport(10.0, 20.0, 1.5);
        assert_eq!(vp.x(), 10.0);
        assert_eq!(vp.y(), 20.0);
        assert_eq!(vp.scale(), 1.5);
        assert!(vp.is_dirty());
    }

    #[test]
    fn test_mark_dirty() {
        let mut vp = Viewport::new();
        vp.mark_clean();
        assert!(!vp.is_dirty());

        vp.mark_dirty();
        assert!(vp.is_dirty());
    }

    #[test]
    fn test_view_projection_matrix_not_zero() {
        let vp = Viewport::with_size(800.0, 600.0);
        let matrix = vp.view_projection_matrix();

        // Matrix should not be all zeros
        let cols: [[f32; 4]; 4] = matrix.to_cols_array_2d();
        let has_nonzero = cols.iter().flatten().any(|&v| v != 0.0);
        assert!(has_nonzero, "Matrix should have non-zero elements");
    }

    #[test]
    fn test_view_projection_matrix_with_offset() {
        let vp = Viewport::with_size(800.0, 600.0);
        let matrix_no_offset = vp.view_projection_matrix();
        let matrix_with_offset = vp.view_projection_matrix_with_offset(50.0, 30.0);

        // Matrices should be different when offset is applied
        assert_ne!(
            matrix_no_offset.to_cols_array(),
            matrix_with_offset.to_cols_array()
        );
    }

    #[test]
    fn test_visible_hash_bounds() {
        let vp = Viewport::with_size(800.0, 600.0);
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();
        let hash_bounds = vp.visible_hash_bounds(&offsets);

        // With default viewport at origin, we should have some valid hash bounds
        assert!(hash_bounds.min_hash_x <= hash_bounds.max_hash_x);
        assert!(hash_bounds.min_hash_y <= hash_bounds.max_hash_y);
    }
}
