//! ViewportSource - abstracts between local and shared viewport for rendering
//!
//! This module provides the ViewportSource enum that allows the renderer to work
//! with either a local Viewport (for native/testing) or a shared ViewportBuffer
//! (for WASM with SharedArrayBuffer).
//!
//! The actual ViewportBuffer implementation is in quadratic-core-shared.

use glam::Mat4;

#[cfg(feature = "js")]
use glam::Vec2;

// Re-export from core-shared
#[cfg(feature = "js")]
pub use quadratic_core_shared::ViewportBuffer;
pub use quadratic_core_shared::VisibleBounds;

/// A viewport that can be either local (managed by Rust) or shared (from SharedArrayBuffer)
pub enum ViewportSource {
    /// Local viewport managed by Rust (for native/testing)
    Local(super::Viewport),

    /// Shared viewport read from SharedArrayBuffer (JS/WASM only)
    #[cfg(feature = "js")]
    Shared(ViewportBuffer),
}

impl ViewportSource {
    /// Check if this is a shared viewport
    pub fn is_shared(&self) -> bool {
        #[cfg(feature = "js")]
        {
            matches!(self, ViewportSource::Shared(_))
        }
        #[cfg(not(feature = "js"))]
        {
            false
        }
    }

    /// Get the scale
    pub fn scale(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.scale(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.scale(),
        }
    }

    /// Get the effective scale
    pub fn effective_scale(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.effective_scale(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.effective_scale(),
        }
    }

    /// Get the X position
    pub fn x(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.x(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.x(),
        }
    }

    /// Get the Y position
    pub fn y(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.y(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.y(),
        }
    }

    /// Get the viewport width
    pub fn width(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.width(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.width(),
        }
    }

    /// Get the viewport height
    pub fn height(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.height(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.height(),
        }
    }

    /// Get the DPR
    pub fn dpr(&self) -> f32 {
        match self {
            ViewportSource::Local(v) => v.dpr(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.dpr(),
        }
    }

    /// Get the visible bounds
    pub fn visible_bounds(&self) -> VisibleBounds {
        match self {
            ViewportSource::Local(v) => v.visible_bounds(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.visible_bounds(),
        }
    }

    /// Get the view-projection matrix for rendering
    pub fn view_projection_matrix(&self) -> Mat4 {
        self.view_projection_matrix_with_offset(0.0, 0.0)
    }

    /// Get the view-projection matrix with an offset for headings
    /// offset_x: horizontal offset in device pixels (e.g., row header width)
    /// offset_y: vertical offset in device pixels (e.g., column header height)
    pub fn view_projection_matrix_with_offset(&self, offset_x: f32, offset_y: f32) -> Mat4 {
        match self {
            ViewportSource::Local(v) => v.view_projection_matrix_with_offset(offset_x, offset_y),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => {
                // Compute view-projection matrix from ViewportBuffer data
                let content_width = v.width() - offset_x;
                let content_height = v.height() - offset_y;
                let effective_scale = v.effective_scale();

                // Add a small margin in device pixels for cursor outlines
                let margin_pixels = 2.0;
                let margin_world = margin_pixels / effective_scale;

                // Orthographic projection for 2D
                let projection =
                    Mat4::orthographic_rh(0.0, content_width, content_height, 0.0, -1.0, 1.0);

                // View matrix (camera transform)
                let view = Mat4::from_scale_rotation_translation(
                    glam::Vec3::new(effective_scale, effective_scale, 1.0),
                    glam::Quat::IDENTITY,
                    glam::Vec3::new(
                        (-v.x() + margin_world) * effective_scale,
                        (-v.y() + margin_world) * effective_scale,
                        0.0,
                    ),
                );

                projection * view
            }
        }
    }

    /// Check if dirty
    pub fn is_dirty(&self) -> bool {
        match self {
            ViewportSource::Local(v) => v.dirty,
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.dirty,
        }
    }

    /// Mark as clean
    pub fn mark_clean(&mut self) {
        match self {
            ViewportSource::Local(v) => v.mark_clean(),
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.mark_clean(),
        }
    }

    /// Sync from buffer (for shared viewport)
    pub fn sync(&mut self) -> bool {
        match self {
            ViewportSource::Local(_) => false,
            #[cfg(feature = "js")]
            ViewportSource::Shared(v) => v.sync(),
        }
    }

    /// Get the sheet_id (only available for shared viewports)
    /// Returns None for local viewports
    #[cfg(feature = "js")]
    pub fn sheet_id(&self) -> Option<quadratic_core_shared::SheetId> {
        match self {
            ViewportSource::Local(_) => None,
            ViewportSource::Shared(v) => v.sheet_id(),
        }
    }

    /// Get the viewport size as Vec2 (renderer convenience method)
    #[cfg(feature = "js")]
    pub fn size(&self) -> Vec2 {
        Vec2::new(self.width(), self.height())
    }

    /// Convert screen coordinates to world coordinates (renderer convenience method)
    #[cfg(feature = "js")]
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> Vec2 {
        match self {
            ViewportSource::Local(v) => v.screen_to_world(screen_x, screen_y),
            ViewportSource::Shared(v) => {
                let (x, y) = v.screen_to_world(screen_x, screen_y);
                Vec2::new(x, y)
            }
        }
    }

    /// Convert world coordinates to screen coordinates (renderer convenience method)
    #[cfg(feature = "js")]
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> Vec2 {
        match self {
            ViewportSource::Local(v) => v.world_to_screen(world_x, world_y),
            ViewportSource::Shared(v) => {
                let (x, y) = v.world_to_screen(world_x, world_y);
                Vec2::new(x, y)
            }
        }
    }
}
