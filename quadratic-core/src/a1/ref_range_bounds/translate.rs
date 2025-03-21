use crate::RefError;

use super::*;

impl RefRangeBounds {
    /// Translates the range in place by the given delta.
    pub fn translate_in_place(&mut self, x: i64, y: i64) -> Result<(), RefError> {
        if self.is_all() {
            return Ok(());
        }
        self.start.translate_in_place(x, y)?;
        self.end.translate_in_place(x, y)?;
        Ok(())
    }

    /// Returns a new range translated by the given delta.
    pub fn translate(mut self, x: i64, y: i64) -> Result<Self, RefError> {
        self.translate_in_place(x, y)?;
        Ok(self)
    }

    pub fn saturating_translate(self, x: i64, y: i64) -> Option<Self> {
        if self.is_all() {
            return Some(self);
        }
        Some(Self {
            // clamp start to A1
            start: self.start.saturating_translate(x, y),
            // if end goes past A1, then the new range is empty so return nothing
            end: self.end.translate(x, y).ok()?,
        })
    }

    // TODO: remove this function when switching to u64
    pub fn translate_unchecked(self, x: i64, y: i64) -> Self {
        if self.is_all() {
            return self;
        }
        Self {
            start: self.start.translate_unchecked(x, y),
            end: self.end.translate_unchecked(x, y),
        }
    }

    pub fn adjust_column_row_in_place(
        &mut self,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        self.start.adjust_column_row_in_place(column, row, delta);
        self.end.adjust_column_row_in_place(column, row, delta);
    }

    #[must_use]
    pub fn adjust_column_row(mut self, column: Option<i64>, row: Option<i64>, delta: i64) -> Self {
        self.adjust_column_row_in_place(column, row, delta);
        self
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
