use super::*;

impl RefRangeBounds {
    /// Translates the range in place by the given delta.
    pub fn normalize_in_place(&mut self) {
        let rect = self.to_rect_unbounded();
        self.start = CellRefRangeEnd::new_relative_pos(rect.min);
        self.end = CellRefRangeEnd::new_relative_pos(rect.max);
    }

    /// Returns a new range translated by the given delta.
    pub fn normalize(&self) -> Self {
        let mut range = *self;
        range.normalize_in_place();
        range
    }
}

#[cfg(test)]
mod tests {
    use crate::a1::RefRangeBounds;

    #[test]
    fn test_normalize_in_place() {
        // Test normal range that doesn't need normalization
        let mut range = RefRangeBounds::test_a1("A1:C3");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "A1:C3");

        // Test range that needs column normalization
        let mut range = RefRangeBounds::test_a1("C3:A1");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "A1:C3");

        // Test range that needs row normalization
        let mut range = RefRangeBounds::test_a1("A3:C1");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "A1:C3");

        // Test range that needs both column and row normalization
        let mut range = RefRangeBounds::test_a1("C3:A1");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "A1:C3");

        // Test single cell (should remain unchanged)
        let mut range = RefRangeBounds::test_a1("B2");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "B2");

        // Test column range
        let mut range = RefRangeBounds::test_a1("C:A");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "A:C");

        // Test row range
        let mut range = RefRangeBounds::test_a1("3:1");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "1:3");

        // Test that * remains unchanged
        let mut range = RefRangeBounds::test_a1("*");
        range.normalize_in_place();
        assert_eq!(range.to_string(), "*");
    }

    #[test]
    fn test_normalize() {
        // Test normal range that doesn't need normalization
        let range = RefRangeBounds::test_a1("A1:C3");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "A1:C3");

        // Test range that needs column normalization
        let range = RefRangeBounds::test_a1("C3:A1");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "C3:A1");

        // Test range that needs row normalization
        let range = RefRangeBounds::test_a1("A3:C1");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "A3:C1");

        // Test range that needs both column and row normalization
        let range = RefRangeBounds::test_a1("C3:A1");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "C3:A1");

        // Test single cell (should remain unchanged)
        let range = RefRangeBounds::test_a1("B2");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "B2");
        assert_eq!(range.to_string(), "B2");

        // Test column range
        let range = RefRangeBounds::test_a1("C:A");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "A:C");
        assert_eq!(range.to_string(), "C:A");

        // Test row range
        let range = RefRangeBounds::test_a1("3:1");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "1:3");
        assert_eq!(range.to_string(), "3:1");

        // Test that * remains unchanged
        let range = RefRangeBounds::test_a1("*");
        let normalized = range.normalize();
        assert_eq!(normalized.to_string(), "*");
        assert_eq!(range.to_string(), "*");
    }
}
