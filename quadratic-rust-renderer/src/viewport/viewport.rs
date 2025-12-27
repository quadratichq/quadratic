//! Viewport - manages camera position and zoom
//!
//! This is a read-only view of the viewport state that is controlled by the
//! main thread via SharedArrayBuffer. The Rust renderer only reads this state.

use glam::{Mat4, Vec2};

/// Represents the visible region of the infinite grid
///
/// This struct holds the current viewport state. When using SharedArrayBuffer,
/// this state is synced from the buffer each frame. The viewport does not
/// perform any manipulation (pan, zoom, deceleration) - that is all handled
/// by TypeScript on the main thread.
pub struct Viewport {
    /// Position of the viewport in world coordinates
    position: Vec2,

    /// Scale factor (zoom level)
    scale: f32,

    /// Device pixel ratio (for high-DPI displays)
    dpr: f32,

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
    /// Create a new viewport with the given dimensions
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            position: Vec2::ZERO,
            scale: 1.0,
            dpr: 1.0,
            size: Vec2::new(width, height),
            dirty: true,
            min_scale: 0.01,
            max_scale: f32::MAX,
        }
    }

    // =========================================================================
    // State Setters (called when syncing from SharedArrayBuffer)
    // =========================================================================

    /// Resize the viewport with device pixel ratio
    ///
    /// # Arguments
    /// * `width` - Width in device pixels
    /// * `height` - Height in device pixels
    /// * `dpr` - Device pixel ratio (e.g., 2.0 for Retina displays)
    pub fn resize(&mut self, width: f32, height: f32, dpr: f32) {
        self.size = Vec2::new(width, height);
        if (self.dpr - dpr).abs() > 0.001 {
            self.dpr = dpr;
        }
        self.dirty = true;
    }

    /// Set the viewport position directly (from SharedArrayBuffer)
    pub fn set_position(&mut self, x: f32, y: f32) {
        self.position = Vec2::new(x, y);
        self.dirty = true;
    }

    /// Set the scale directly (from SharedArrayBuffer)
    pub fn set_scale(&mut self, scale: f32) {
        self.scale = scale.clamp(self.min_scale, self.max_scale);
        self.dirty = true;
    }

    /// Mark the viewport as clean (after rendering)
    pub fn mark_clean(&mut self) {
        self.dirty = false;
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
}

/// Represents the visible area in world coordinates
#[derive(Debug, Clone, Copy)]
pub struct VisibleBounds {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub width: f32,
    pub height: f32,
}
