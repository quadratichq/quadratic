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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_bounds_new() {
        let bounds = TableBounds::new(10.0, 20.0, 100.0, 50.0);
        assert_eq!(bounds.x, 10.0);
        assert_eq!(bounds.y, 20.0);
        assert_eq!(bounds.width, 100.0);
        assert_eq!(bounds.height, 50.0);
    }

    #[test]
    fn test_table_bounds_default() {
        let bounds = TableBounds::default();
        assert_eq!(bounds.x, 0.0);
        assert_eq!(bounds.y, 0.0);
        assert_eq!(bounds.width, 0.0);
        assert_eq!(bounds.height, 0.0);
    }

    #[test]
    fn test_edges() {
        let bounds = TableBounds::new(10.0, 20.0, 100.0, 50.0);
        assert_eq!(bounds.left(), 10.0);
        assert_eq!(bounds.top(), 20.0);
        assert_eq!(bounds.right(), 110.0);
        assert_eq!(bounds.bottom(), 70.0);
    }

    #[test]
    fn test_intersects_true() {
        let bounds1 = TableBounds::new(0.0, 0.0, 100.0, 100.0);
        let bounds2 = TableBounds::new(50.0, 50.0, 100.0, 100.0);

        assert!(bounds1.intersects(&bounds2));
        assert!(bounds2.intersects(&bounds1));
    }

    #[test]
    fn test_intersects_false() {
        let bounds1 = TableBounds::new(0.0, 0.0, 100.0, 100.0);
        let bounds2 = TableBounds::new(200.0, 200.0, 100.0, 100.0);

        assert!(!bounds1.intersects(&bounds2));
        assert!(!bounds2.intersects(&bounds1));
    }

    #[test]
    fn test_intersects_edge() {
        let bounds1 = TableBounds::new(0.0, 0.0, 100.0, 100.0);
        let bounds2 = TableBounds::new(100.0, 0.0, 100.0, 100.0);

        // Touching edges should NOT intersect (exclusive)
        assert!(!bounds1.intersects(&bounds2));
    }

    #[test]
    fn test_contains_point_inside() {
        let bounds = TableBounds::new(10.0, 20.0, 100.0, 50.0);

        assert!(bounds.contains_point(50.0, 40.0));
        assert!(bounds.contains_point(10.0, 20.0)); // Edge included
        assert!(bounds.contains_point(110.0, 70.0)); // Edge included
    }

    #[test]
    fn test_contains_point_outside() {
        let bounds = TableBounds::new(10.0, 20.0, 100.0, 50.0);

        assert!(!bounds.contains_point(5.0, 40.0)); // Left of bounds
        assert!(!bounds.contains_point(50.0, 10.0)); // Above bounds
        assert!(!bounds.contains_point(150.0, 40.0)); // Right of bounds
        assert!(!bounds.contains_point(50.0, 80.0)); // Below bounds
    }

    #[test]
    fn test_intersects_viewport_true() {
        let bounds = TableBounds::new(50.0, 50.0, 100.0, 100.0);

        assert!(bounds.intersects_viewport(0.0, 0.0, 200.0, 200.0)); // Fully contained
        assert!(bounds.intersects_viewport(75.0, 75.0, 125.0, 125.0)); // Partial overlap
    }

    #[test]
    fn test_intersects_viewport_false() {
        let bounds = TableBounds::new(50.0, 50.0, 100.0, 100.0);

        assert!(!bounds.intersects_viewport(200.0, 200.0, 300.0, 300.0)); // No overlap
        assert!(!bounds.intersects_viewport(0.0, 0.0, 50.0, 50.0)); // Touching edge only
    }
}
