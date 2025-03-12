use crate::{RefAdjust, RefError};

use super::*;

impl RefRangeBounds {
    /// Adjusts coordinates by `adjust`. Returns an error if the result is out
    /// of bounds.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn adjust(self, adjust: RefAdjust) -> Result<Self, RefError> {
        Ok(Self {
            start: self.start.adjust(adjust)?,
            end: self.end.adjust(adjust)?,
        })
    }
    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds. Returns `None` if the result is empty.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn saturating_adjust(self, adjust: RefAdjust) -> Option<Self> {
        // If both X coordinates or both Y coordinates end up out of range then
        // the whole range becomes empty.
        if self.start.col.adjust_x(adjust).is_err() && self.end.col.adjust_x(adjust).is_err()
            || self.start.row.adjust_y(adjust).is_err() && self.end.row.adjust_y(adjust).is_err()
        {
            return None;
        }

        Some(Self {
            start: self.start.saturating_adjust(adjust),
            end: self.end.saturating_adjust(adjust),
        })
    }

    // TODO: remove this function when switching to u64
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn translate_unchecked(self, x: i64, y: i64) -> Self {
        if self.is_all() {
            return self;
        }
        Self {
            start: self.start.translate_unchecked(x, y),
            end: self.end.translate_unchecked(x, y),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_translate_in_place() {
        // Test single cell translation
        let mut range = RefRangeBounds::test_a1("A1");
        range.translate_in_place(1, 1).unwrap();
        assert_eq!(range.to_string(), "B2");

        // Test range translation
        let mut range = RefRangeBounds::test_a1("A1:C3");
        range.translate_in_place(1, 1).unwrap();
        assert_eq!(range.to_string(), "B2:D4");

        // Test column range translation
        let mut range = RefRangeBounds::test_a1("A:C");
        range.translate_in_place(1, 0).unwrap();
        assert_eq!(range.to_string(), "B:D");

        // Test row range translation
        let mut range = RefRangeBounds::test_a1("1:3");
        range.translate_in_place(0, 1).unwrap();
        assert_eq!(range.to_string(), "2:4");

        // Test negative translation
        let mut range = RefRangeBounds::test_a1("B2:D4");
        range.translate_in_place(-1, -1).unwrap();
        assert_eq!(range.to_string(), "A1:C3");

        // Test zero translation
        let mut range = RefRangeBounds::test_a1("A1:C3");
        range.translate_in_place(0, 0).unwrap();
        assert_eq!(range.to_string(), "A1:C3");

        // Test that * remains unchanged
        let mut range = RefRangeBounds::test_a1("*");
        range.translate_in_place(1, 1).unwrap();
        assert_eq!(range.to_string(), "*");

        // Test negative translation capping
        let mut range = RefRangeBounds::test_a1("A1");
        range.translate_in_place(-10, -10).unwrap_err();
    }

    #[test]
    fn test_translate() {
        // Test single cell translation
        let range = RefRangeBounds::test_a1("A1");
        let translated = range.translate(1, 1).unwrap();
        assert_eq!(translated.to_string(), "B2");
        assert_eq!(range.to_string(), "A1");

        // Test range translation
        let range = RefRangeBounds::test_a1("A1:C3");
        let translated = range.translate(1, 1).unwrap();
        assert_eq!(translated.to_string(), "B2:D4");
        assert_eq!(range.to_string(), "A1:C3");

        // Test column range translation
        let range = RefRangeBounds::test_a1("A:C");
        let translated = range.translate(1, 0).unwrap();
        assert_eq!(translated.to_string(), "B:D");
        assert_eq!(range.to_string(), "A:C");

        // Test row range translation
        let range = RefRangeBounds::test_a1("1:3");
        let translated = range.translate(0, 1).unwrap();
        assert_eq!(translated.to_string(), "2:4");
        assert_eq!(range.to_string(), "1:3");

        // Test negative translation
        let range = RefRangeBounds::test_a1("B2:D4");
        let translated = range.translate(-1, -1).unwrap();
        assert_eq!(translated.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "B2:D4");

        // Test zero translation
        let range = RefRangeBounds::test_a1("A1:C3");
        let translated = range.translate(0, 0).unwrap();
        assert_eq!(translated.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "A1:C3");

        // Test that * remains unchanged
        let range = RefRangeBounds::test_a1("*");
        let translated = range.translate(1, 1).unwrap();
        assert_eq!(translated.to_string(), "*");
        assert_eq!(range.to_string(), "*");

        // Test negative translation capping
        let range = RefRangeBounds::test_a1("A1");
        range.translate(-10, -10).unwrap_err();
    }

    #[test]
    fn test_adjust_column_row() {
        let mut range = RefRangeBounds::test_a1("B3");
        range.adjust_column_row_in_place(Some(2), None, 1);
        assert_eq!(range.to_string(), "C3");

        let mut range = RefRangeBounds::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(2), 1);
        assert_eq!(range.to_string(), "B4");

        let mut range = RefRangeBounds::test_a1("B3");
        range.adjust_column_row_in_place(Some(3), None, 1);
        assert_eq!(range.to_string(), "B3");

        let mut range = RefRangeBounds::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(4), 1);
        assert_eq!(range.to_string(), "B3");

        let mut range = RefRangeBounds::test_a1("B3");
        range.adjust_column_row_in_place(Some(1), None, -1);
        assert_eq!(range.to_string(), "A3");

        let mut range = RefRangeBounds::test_a1("B3");
        range.adjust_column_row_in_place(None, Some(1), -1);
        assert_eq!(range.to_string(), "B2");
    }
}
