//! Viewport - manages camera position and zoom
//!
//! Equivalent to Viewport.ts from the Pixi.js implementation

use glam::{Mat4, Vec2};

use super::decelerate::{Decelerate, DecelerateOptions};

/// Velocity for snap-back animation (px/ms)
pub const SNAP_BACK_VELOCITY: f32 = 1.5;

/// Maximum negative distance allowed before snap-back becomes stronger
pub const SNAP_BACK_MAX_DISTANCE: f32 = 200.0;

/// Delay before snap-back starts after zooming (ms)
/// This allows continuous zooming without snap-back interruption
pub const SNAP_BACK_DELAY: f32 = 300.0;

/// Represents the visible region of the infinite grid
pub struct Viewport {
    /// Position of the viewport in world coordinates
    position: Vec2,

    /// Scale factor (zoom level)
    scale: f32,

    /// Device pixel ratio (for high-DPI displays)
    /// The rendering scale is multiplied by this value to ensure
    /// world units appear at the correct size on screen.
    dpr: f32,

    /// Size of the viewport in device pixels
    size: Vec2,

    /// Whether the viewport has changed and needs re-rendering
    pub dirty: bool,

    /// Minimum allowed scale
    min_scale: f32,

    /// Maximum allowed scale
    max_scale: f32,

    /// Deceleration plugin for smooth momentum scrolling
    decelerate: Decelerate,

    /// Remaining delay before snap-back starts (ms)
    /// When > 0, snap-back is delayed to allow continuous zooming
    snap_back_delay_remaining: f32,
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
            decelerate: Decelerate::new(DecelerateOptions::default()),
            snap_back_delay_remaining: 0.0,
        }
    }

    /// Create a new viewport with custom decelerate options
    pub fn with_decelerate_options(width: f32, height: f32, options: DecelerateOptions) -> Self {
        Self {
            position: Vec2::ZERO,
            scale: 1.0,
            dpr: 1.0,
            size: Vec2::new(width, height),
            dirty: true,
            min_scale: 0.01,
            max_scale: f32::MAX,
            decelerate: Decelerate::new(options),
            snap_back_delay_remaining: 0.0,
        }
    }

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

    /// Set the device pixel ratio
    pub fn set_dpr(&mut self, dpr: f32) {
        if (self.dpr - dpr).abs() > 0.001 {
            self.dpr = dpr;
            self.dirty = true;
        }
    }

    /// Get the device pixel ratio
    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    /// Pan the viewport by a screen-space delta (in device pixels)
    ///
    /// Clamps to prevent panning into negative space (x < 0, y < 0).
    pub fn pan(&mut self, dx: f32, dy: f32) {
        // Convert screen delta to world delta using effective scale
        let effective_scale = self.scale * self.dpr;
        let world_dx = dx / effective_scale;
        let world_dy = dy / effective_scale;

        // Apply pan and clamp to prevent negative positions
        self.position.x = (self.position.x - world_dx).max(0.0);
        self.position.y = (self.position.y - world_dy).max(0.0);
        self.dirty = true;
    }

    /// Zoom around a screen-space point (pinch-to-zoom behavior)
    ///
    /// This implements the pixi-viewport algorithm:
    /// 1. Get world position of cursor before zoom
    /// 2. Apply zoom
    /// 3. Get new screen position of that world point after zoom
    /// 4. Move viewport so cursor stays at same world position
    ///
    /// Note: center_x and center_y are in device pixels
    pub fn zoom(&mut self, factor: f32, center_x: f32, center_y: f32) {
        let old_scale = self.scale;
        let new_scale = (self.scale * factor).clamp(self.min_scale, self.max_scale);

        if (new_scale - old_scale).abs() > f32::EPSILON {
            // Step 1: Get world position of cursor before zoom
            let world_point = self.screen_to_world(center_x, center_y);

            // Step 2: Apply zoom
            self.scale = new_scale;

            // Step 3: Get new screen position of that world point after zoom
            let new_screen = self.world_to_screen(world_point.x, world_point.y);

            // Step 4: Move viewport so cursor stays at same world position
            // The difference in screen space needs to be converted to world space
            let effective_scale = self.scale * self.dpr;
            let dx = (center_x - new_screen.x) / effective_scale;
            let dy = (center_y - new_screen.y) / effective_scale;
            self.position.x -= dx;
            self.position.y -= dy;

            // Reset snap-back delay when zooming into negative space
            // This allows continuous zooming without snap-back interruption
            if self.position.x < 0.0 || self.position.y < 0.0 {
                self.snap_back_delay_remaining = SNAP_BACK_DELAY;
            }

            self.dirty = true;
        }
    }

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

    /// Get the view-projection matrix for rendering
    pub fn view_projection_matrix(&self) -> Mat4 {
        self.view_projection_matrix_with_offset(0.0, 0.0)
    }

    /// Get the view-projection matrix with an offset for headings
    /// offset_x: horizontal offset in device pixels (e.g., row header width)
    /// offset_y: vertical offset in device pixels (e.g., column header height)
    ///
    /// Note: The caller should use glViewport to set the rendering area to the content
    /// area (x=offset_x, y=offset_y, width=canvas_width-offset_x, height=canvas_height-offset_y).
    /// This matrix maps world coordinates to that viewport.
    pub fn view_projection_matrix_with_offset(&self, offset_x: f32, offset_y: f32) -> Mat4 {
        // Calculate the content area dimensions in device pixels
        let content_width = self.size.x - offset_x;
        let content_height = self.size.y - offset_y;

        // The effective scale combines the user's zoom level with the device pixel ratio.
        // This ensures world units (e.g., a 100px wide cell) appear at the correct
        // size on screen regardless of display DPR.
        let effective_scale = self.scale * self.dpr;

        // Add a small margin in device pixels for cursor outlines at the grid edges.
        // Cursor borders are 2px thick, so we need at least 1px margin on each side.
        // This margin is converted to world units and added to the visible area.
        let margin_pixels = 2.0;
        let margin_world = margin_pixels / effective_scale;

        // Orthographic projection for 2D
        // Maps world coordinates to the content area in device pixels
        let projection = Mat4::orthographic_rh(0.0, content_width, content_height, 0.0, -1.0, 1.0);

        // View matrix (camera transform)
        // Add margin offset so that world coordinate (0, 0) is slightly inset from the edge,
        // leaving room for cursor outlines at cell A1.
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

    /// Set the viewport position directly
    pub fn set_position(&mut self, x: f32, y: f32) {
        self.position = Vec2::new(x, y);
        self.dirty = true;
    }

    /// Get the current user-visible scale (zoom level)
    pub fn scale(&self) -> f32 {
        self.scale
    }

    /// Get the effective rendering scale (scale * dpr)
    ///
    /// This is what should be used for pixel-scaled elements
    /// (like cursor borders) to ensure they appear correctly on screen.
    pub fn effective_scale(&self) -> f32 {
        self.scale * self.dpr
    }

    /// Set the scale directly
    pub fn set_scale(&mut self, scale: f32) {
        self.scale = scale.clamp(self.min_scale, self.max_scale);
        self.dirty = true;
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

    /// Mark the viewport as clean (after rendering)
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    // =========================================================================
    // Deceleration (momentum scrolling)
    // =========================================================================

    /// Check if deceleration is currently active
    pub fn is_decelerating(&self) -> bool {
        self.decelerate.is_active()
    }

    /// Called when drag/pan starts - stops any active deceleration
    pub fn on_drag_start(&mut self) {
        self.decelerate.on_down();
    }

    /// Called during drag/pan - records position for velocity calculation
    ///
    /// # Arguments
    /// * `time` - Current time in milliseconds (e.g., from performance.now())
    pub fn on_drag_move(&mut self, time: f64) {
        self.decelerate.on_move(self.position, time);
    }

    /// Called when drag/pan ends - calculates velocity and starts deceleration
    ///
    /// # Arguments
    /// * `time` - Current time in milliseconds
    pub fn on_drag_end(&mut self, time: f64) {
        self.decelerate.on_up(self.position, time);
    }

    /// Called on wheel event - stops deceleration
    pub fn on_wheel(&mut self) {
        self.decelerate.on_wheel();
    }

    /// Update deceleration and apply velocity to viewport
    ///
    /// Call this each frame to apply momentum scrolling.
    /// Also handles snap-back when viewport is in negative space (after zoom).
    ///
    /// # Arguments
    /// * `elapsed` - Time elapsed since last update in milliseconds
    ///
    /// # Returns
    /// `true` if the viewport was moved by deceleration or snap-back
    pub fn update_decelerate(&mut self, elapsed: f32) -> bool {
        let mut moved = false;

        // Apply regular deceleration with clamping
        if let Some(delta) = self.decelerate.update(elapsed, self.position) {
            self.position += delta;

            // Clamp to prevent going negative during deceleration
            // (only zoom can temporarily go negative)
            self.position.x = self.position.x.max(0.0);
            self.position.y = self.position.y.max(0.0);

            self.dirty = true;
            moved = true;
        }

        // Update snap-back delay countdown
        if self.snap_back_delay_remaining > 0.0 {
            self.snap_back_delay_remaining = (self.snap_back_delay_remaining - elapsed).max(0.0);
        }

        // Check for snap-back when not actively decelerating and delay has expired
        if !self.decelerate.is_active() && self.snap_back_delay_remaining <= 0.0 {
            moved |= self.apply_snap_back(elapsed);
        }

        moved
    }

    /// Apply snap-back animation when viewport is in negative space
    ///
    /// Returns true if the viewport was moved
    fn apply_snap_back(&mut self, elapsed: f32) -> bool {
        let mut moved = false;

        // Snap back X if in negative space
        if self.position.x < 0.0 {
            let distance = -self.position.x;
            // Move faster when further away, with a minimum speed
            let speed = (distance / SNAP_BACK_MAX_DISTANCE).max(0.3) * SNAP_BACK_VELOCITY;
            let delta = speed * elapsed;

            if delta >= distance {
                self.position.x = 0.0;
            } else {
                self.position.x += delta;
            }
            self.dirty = true;
            moved = true;
        }

        // Snap back Y if in negative space
        if self.position.y < 0.0 {
            let distance = -self.position.y;
            let speed = (distance / SNAP_BACK_MAX_DISTANCE).max(0.3) * SNAP_BACK_VELOCITY;
            let delta = speed * elapsed;

            if delta >= distance {
                self.position.y = 0.0;
            } else {
                self.position.y += delta;
            }
            self.dirty = true;
            moved = true;
        }

        moved
    }

    /// Check if snap-back animation is active
    pub fn is_snapping_back(&self) -> bool {
        self.position.x < 0.0 || self.position.y < 0.0
    }

    /// Manually activate deceleration with a specific velocity
    ///
    /// Useful for programmatic scrolling with momentum.
    ///
    /// # Arguments
    /// * `vx` - X velocity in px/ms
    /// * `vy` - Y velocity in px/ms
    pub fn activate_decelerate(&mut self, vx: f32, vy: f32) {
        self.decelerate.activate(Vec2::new(vx, vy));
    }

    /// Manually activate horizontal deceleration
    pub fn activate_decelerate_x(&mut self, vx: f32) {
        self.decelerate.activate_x(vx);
    }

    /// Manually activate vertical deceleration
    pub fn activate_decelerate_y(&mut self, vy: f32) {
        self.decelerate.activate_y(vy);
    }

    /// Reset/stop deceleration
    pub fn reset_decelerate(&mut self) {
        self.decelerate.reset();
    }

    /// Pause deceleration
    pub fn pause_decelerate(&mut self) {
        self.decelerate.pause();
    }

    /// Resume deceleration
    pub fn resume_decelerate(&mut self) {
        self.decelerate.resume();
    }

    /// Get access to the decelerate plugin for advanced usage
    pub fn decelerate(&self) -> &Decelerate {
        &self.decelerate
    }

    /// Get mutable access to the decelerate plugin for advanced usage
    pub fn decelerate_mut(&mut self) -> &mut Decelerate {
        &mut self.decelerate
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
