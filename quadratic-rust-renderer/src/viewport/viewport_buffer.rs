//! ViewportBuffer - reads viewport state from SharedArrayBuffer
//!
//! This module provides a way to read viewport state that is controlled
//! by the main thread and synced via SharedArrayBuffer.
//!
//! Buffer Layout (Float32Array, 8 floats = 32 bytes):
//!   [0] positionX   - Viewport X position in world coordinates
//!   [1] positionY   - Viewport Y position in world coordinates
//!   [2] scale       - Zoom level (1.0 = 100%)
//!   [3] dpr         - Device pixel ratio
//!   [4] width       - Viewport width in device pixels
//!   [5] height      - Viewport height in device pixels
//!   [6] dirty       - Dirty flag (1.0 = dirty, 0.0 = clean)
//!   [7] reserved    - Reserved for future use

use glam::{Mat4, Vec2};
use js_sys::{Float32Array, SharedArrayBuffer};

/// Size of the viewport buffer in bytes
pub const VIEWPORT_BUFFER_SIZE: u32 = 32; // 8 floats * 4 bytes each

/// Indices into the Float32Array
#[repr(usize)]
pub enum ViewportBufferIndex {
    PositionX = 0,
    PositionY = 1,
    Scale = 2,
    Dpr = 3,
    Width = 4,
    Height = 5,
    Dirty = 6,
    Reserved = 7,
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

/// ViewportBuffer - reads viewport state from SharedArrayBuffer
///
/// The viewport state is controlled by the main thread and synced via SharedArrayBuffer.
/// The renderer reads from this buffer on each frame.
pub struct ViewportBuffer {
    /// The SharedArrayBuffer containing viewport state
    buffer: SharedArrayBuffer,

    /// Float32Array view into the buffer
    view: Float32Array,

    /// Cached values for performance
    position_x: f32,
    position_y: f32,
    scale: f32,
    dpr: f32,
    width: f32,
    height: f32,

    /// Whether the viewport has been marked dirty since last frame
    pub dirty: bool,

    /// Minimum allowed scale
    min_scale: f32,

    /// Maximum allowed scale
    max_scale: f32,
}

impl ViewportBuffer {
    /// Create a new ViewportBuffer from a SharedArrayBuffer
    pub fn from_buffer(buffer: SharedArrayBuffer) -> Self {
        let view = Float32Array::new(&buffer);

        // Read initial values
        let position_x = view.get_index(ViewportBufferIndex::PositionX as u32);
        let position_y = view.get_index(ViewportBufferIndex::PositionY as u32);
        let scale = view.get_index(ViewportBufferIndex::Scale as u32);
        let dpr = view.get_index(ViewportBufferIndex::Dpr as u32);
        let width = view.get_index(ViewportBufferIndex::Width as u32);
        let height = view.get_index(ViewportBufferIndex::Height as u32);
        let dirty_value = view.get_index(ViewportBufferIndex::Dirty as u32);

        Self {
            buffer,
            view,
            position_x,
            position_y,
            scale: scale.max(0.01),
            dpr: dpr.max(1.0),
            width,
            height,
            dirty: dirty_value != 0.0,
            min_scale: 0.01,
            max_scale: f32::MAX,
        }
    }

    /// Sync from the SharedArrayBuffer - call this each frame
    ///
    /// Returns true if the viewport has changed since last sync
    pub fn sync(&mut self) -> bool {
        let new_x = self.view.get_index(ViewportBufferIndex::PositionX as u32);
        let new_y = self.view.get_index(ViewportBufferIndex::PositionY as u32);
        let new_scale = self.view.get_index(ViewportBufferIndex::Scale as u32);
        let new_dpr = self.view.get_index(ViewportBufferIndex::Dpr as u32);
        let new_width = self.view.get_index(ViewportBufferIndex::Width as u32);
        let new_height = self.view.get_index(ViewportBufferIndex::Height as u32);
        let dirty_value = self.view.get_index(ViewportBufferIndex::Dirty as u32);

        let changed = (self.position_x - new_x).abs() > f32::EPSILON
            || (self.position_y - new_y).abs() > f32::EPSILON
            || (self.scale - new_scale).abs() > f32::EPSILON
            || (self.dpr - new_dpr).abs() > f32::EPSILON
            || (self.width - new_width).abs() > f32::EPSILON
            || (self.height - new_height).abs() > f32::EPSILON
            || dirty_value != 0.0;

        self.position_x = new_x;
        self.position_y = new_y;
        self.scale = new_scale.max(self.min_scale).min(self.max_scale);
        self.dpr = new_dpr.max(1.0);
        self.width = new_width;
        self.height = new_height;
        self.dirty = dirty_value != 0.0;

        changed
    }

    /// Get the SharedArrayBuffer
    pub fn buffer(&self) -> &SharedArrayBuffer {
        &self.buffer
    }

    /// Get the device pixel ratio
    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    /// Convert screen coordinates (device pixels) to world coordinates
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> Vec2 {
        let effective_scale = self.scale * self.dpr;
        Vec2::new(
            self.position_x + screen_x / effective_scale,
            self.position_y + screen_y / effective_scale,
        )
    }

    /// Convert world coordinates to screen coordinates (device pixels)
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> Vec2 {
        let effective_scale = self.scale * self.dpr;
        Vec2::new(
            (world_x - self.position_x) * effective_scale,
            (world_y - self.position_y) * effective_scale,
        )
    }

    /// Get the view-projection matrix for rendering
    pub fn view_projection_matrix(&self) -> Mat4 {
        self.view_projection_matrix_with_offset(0.0, 0.0)
    }

    /// Get the view-projection matrix with an offset for headings
    pub fn view_projection_matrix_with_offset(&self, offset_x: f32, offset_y: f32) -> Mat4 {
        let content_width = self.width - offset_x;
        let content_height = self.height - offset_y;
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
                (-self.position_x + margin_world) * effective_scale,
                (-self.position_y + margin_world) * effective_scale,
                0.0,
            ),
        );

        projection * view
    }

    /// Get the visible bounds in world coordinates
    pub fn visible_bounds(&self) -> VisibleBounds {
        let top_left = self.screen_to_world(0.0, 0.0);
        let bottom_right = self.screen_to_world(self.width, self.height);

        VisibleBounds {
            left: top_left.x,
            top: top_left.y,
            right: bottom_right.x,
            bottom: bottom_right.y,
            width: bottom_right.x - top_left.x,
            height: bottom_right.y - top_left.y,
        }
    }

    /// Get the current scale (zoom level)
    pub fn scale(&self) -> f32 {
        self.scale
    }

    /// Get the effective rendering scale (scale * dpr)
    pub fn effective_scale(&self) -> f32 {
        self.scale * self.dpr
    }

    /// Get the X position
    pub fn x(&self) -> f32 {
        self.position_x
    }

    /// Get the Y position
    pub fn y(&self) -> f32 {
        self.position_y
    }

    /// Get the viewport size
    pub fn size(&self) -> Vec2 {
        Vec2::new(self.width, self.height)
    }

    /// Get the viewport width in screen pixels
    pub fn width(&self) -> f32 {
        self.width
    }

    /// Get the viewport height in screen pixels
    pub fn height(&self) -> f32 {
        self.height
    }

    /// Mark the viewport as clean (after rendering)
    pub fn mark_clean(&mut self) {
        self.dirty = false;
        self.view.set_index(ViewportBufferIndex::Dirty as u32, 0.0);
    }
}

/// A viewport that can be either local (managed by Rust) or shared (from SharedArrayBuffer)
pub enum ViewportSource {
    /// Local viewport managed by Rust (for backwards compatibility)
    Local(super::Viewport),

    /// Shared viewport read from SharedArrayBuffer
    Shared(ViewportBuffer),
}

impl ViewportSource {
    /// Check if this is a shared viewport
    pub fn is_shared(&self) -> bool {
        matches!(self, ViewportSource::Shared(_))
    }

    /// Get the scale
    pub fn scale(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.scale(),
            ViewportSource::Shared(v) => v.scale(),
        }
    }

    /// Get the effective scale
    pub fn effective_scale(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.effective_scale(),
            ViewportSource::Shared(v) => v.effective_scale(),
        }
    }

    /// Get the X position
    pub fn x(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.x(),
            ViewportSource::Shared(v) => v.x(),
        }
    }

    /// Get the Y position
    pub fn y(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.y(),
            ViewportSource::Shared(v) => v.y(),
        }
    }

    /// Get the viewport width
    pub fn width(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.width(),
            ViewportSource::Shared(v) => v.width(),
        }
    }

    /// Get the viewport height
    pub fn height(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.height(),
            ViewportSource::Shared(v) => v.height(),
        }
    }

    /// Get the DPR
    pub fn dpr(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.dpr(),
            ViewportSource::Shared(v) => v.dpr(),
        }
    }

    /// Get the visible bounds
    pub fn visible_bounds(&self) -> VisibleBounds {
        match self {
            ViewportSource::Local(v) => {
                let bounds = v.visible_bounds();
                VisibleBounds {
                    left: bounds.left,
                    top: bounds.top,
                    right: bounds.right,
                    bottom: bounds.bottom,
                    width: bounds.width,
                    height: bounds.height,
                }
            }
            ViewportSource::Shared(v) => v.visible_bounds(),
        }
    }

    /// Get the view-projection matrix
    pub fn view_projection_matrix(&self) -> Mat4 {
        match self {
            ViewportSource::Local(v) => v.view_projection_matrix(),
            ViewportSource::Shared(v) => v.view_projection_matrix(),
        }
    }

    /// Get the view-projection matrix with offset
    pub fn view_projection_matrix_with_offset(&self, offset_x: f32, offset_y: f32) -> Mat4 {
        match self {
            ViewportSource::Local(v) => v.view_projection_matrix_with_offset(offset_x, offset_y),
            ViewportSource::Shared(v) => v.view_projection_matrix_with_offset(offset_x, offset_y),
        }
    }

    /// Check if dirty
    pub fn is_dirty(&self) -> bool {
        match self {
            ViewportSource::Local(v) => v.dirty,
            ViewportSource::Shared(v) => v.dirty,
        }
    }

    /// Mark as clean
    pub fn mark_clean(&mut self) {
        match self {
            ViewportSource::Local(v) => v.mark_clean(),
            ViewportSource::Shared(v) => v.mark_clean(),
        }
    }

    /// Sync from buffer (for shared viewport)
    pub fn sync(&mut self) -> bool {
        match self {
            ViewportSource::Local(_) => false,
            ViewportSource::Shared(v) => v.sync(),
        }
    }
}
