//! Viewport state for layout calculations

use quadratic_renderer_core::{HASH_HEIGHT, HASH_PADDING, HASH_WIDTH};

/// Visible bounds in world coordinates
#[derive(Debug, Clone, Copy, Default)]
pub struct VisibleBounds {
    pub left: f32,
    pub top: f32,
    pub width: f32,
    pub height: f32,
    pub right: f32,
    pub bottom: f32,
}

/// Represents the range of visible hashes (inclusive bounds)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct VisibleHashBounds {
    pub min_hash_x: i64,
    pub max_hash_x: i64,
    pub min_hash_y: i64,
    pub max_hash_y: i64,
}

impl VisibleHashBounds {
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

/// Viewport state for layout calculations
#[derive(Debug, Clone)]
pub struct Viewport {
    /// Position in world coordinates
    x: f32,
    y: f32,

    /// Viewport dimensions in CSS pixels
    width: f32,
    height: f32,

    /// Zoom scale (1.0 = 100%)
    scale: f32,

    /// Device pixel ratio
    pub dpr: f32,

    /// Whether viewport has changed since last update
    pub dirty: bool,
}

impl Default for Viewport {
    fn default() -> Self {
        Self::new(800.0, 600.0)
    }
}

impl Viewport {
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            width,
            height,
            scale: 1.0,
            dpr: 1.0,
            dirty: true,
        }
    }

    // Getters
    pub fn x(&self) -> f32 {
        self.x
    }
    pub fn y(&self) -> f32 {
        self.y
    }
    pub fn width(&self) -> f32 {
        self.width
    }
    pub fn height(&self) -> f32 {
        self.height
    }
    pub fn scale(&self) -> f32 {
        self.scale
    }

    /// Effective scale (scale * dpr) for rendering calculations
    pub fn effective_scale(&self) -> f32 {
        self.scale * self.dpr
    }

    // Setters
    pub fn set_position(&mut self, x: f32, y: f32) {
        if (self.x - x).abs() > 0.001 || (self.y - y).abs() > 0.001 {
            self.x = x;
            self.y = y;
            self.dirty = true;
        }
    }

    pub fn set_scale(&mut self, scale: f32) {
        if (self.scale - scale).abs() > 0.0001 {
            self.scale = scale;
            self.dirty = true;
        }
    }

    pub fn resize(&mut self, width: f32, height: f32, dpr: f32) {
        if (self.width - width).abs() > 0.001
            || (self.height - height).abs() > 0.001
            || (self.dpr - dpr).abs() > 0.001
        {
            self.width = width;
            self.height = height;
            self.dpr = dpr;
            self.dirty = true;
        }
    }

    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Get the visible bounds in world coordinates
    pub fn visible_bounds(&self) -> VisibleBounds {
        // World-space width/height based on zoom
        let world_width = self.width / self.scale;
        let world_height = self.height / self.scale;

        VisibleBounds {
            left: self.x,
            top: self.y,
            width: world_width,
            height: world_height,
            right: self.x + world_width,
            bottom: self.y + world_height,
        }
    }

    /// Get the visible hash bounds for the current viewport
    pub fn visible_hash_bounds(
        &self,
        offsets: &quadratic_core_shared::SheetOffsets,
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
}
