//! Table bounds - rectangle bounds in world coordinates

/// Rectangle bounds in world coordinates
#[derive(Debug, Clone, Copy, Default)]
pub struct TableBounds {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl TableBounds {
    /// Create new bounds
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self { x, y, width, height }
    }

    /// Left edge
    #[inline]
    pub fn left(&self) -> f32 {
        self.x
    }

    /// Top edge
    #[inline]
    pub fn top(&self) -> f32 {
        self.y
    }

    /// Right edge
    #[inline]
    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    /// Bottom edge
    #[inline]
    pub fn bottom(&self) -> f32 {
        self.y + self.height
    }

    /// Check if this bounds intersects with another
    pub fn intersects(&self, other: &TableBounds) -> bool {
        self.left() < other.right()
            && self.right() > other.left()
            && self.top() < other.bottom()
            && self.bottom() > other.top()
    }

    /// Check if a point is inside this bounds
    pub fn contains_point(&self, x: f32, y: f32) -> bool {
        x >= self.left() && x <= self.right() && y >= self.top() && y <= self.bottom()
    }

    /// Check if this bounds intersects a viewport
    pub fn intersects_viewport(
        &self,
        viewport_left: f32,
        viewport_top: f32,
        viewport_right: f32,
        viewport_bottom: f32,
    ) -> bool {
        self.right() > viewport_left
            && self.left() < viewport_right
            && self.bottom() > viewport_top
            && self.top() < viewport_bottom
    }
}
