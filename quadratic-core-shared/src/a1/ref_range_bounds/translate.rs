use crate::{A1Error, RefAdjust};

use super::*;

impl RefRangeBounds {
    /// Returns true if any of the coordinates in the range are unbounded.
    fn is_any_unbounded(self) -> bool {
        let is_col_unbounded = self.end.col.is_unbounded();
        let is_row_unbounded = self.end.row.is_unbounded();

        is_col_unbounded || is_row_unbounded
    }
    /// Adjusts coordinates by `adjust`. Returns an error if the result is out
    /// of bounds.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn adjust(self, adjust: RefAdjust) -> Result<Self, A1Error> {
        let (start, end) = match self.is_any_unbounded() {
            true => (self.start, self.end),
            false => (self.start.adjust(adjust)?, self.end.adjust(adjust)?),
        };

        Ok(Self { start, end })
    }
    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds. Returns `None` if the result is empty.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn saturating_adjust(self, adjust: RefAdjust) -> Option<Self> {
        // If both X coordinates or both Y coordinates end up out of range then
        // the whole range becomes empty.
        let (x1, y1) = self.start.try_adjust_xy(adjust);
        let (x2, y2) = self.end.try_adjust_xy(adjust);
        if x1.is_err() && x2.is_err() || y1.is_err() && y2.is_err() {
            return None;
        }

        let (start, end) = match self.is_any_unbounded() {
            true => (self.start, self.end),
            false => (
                self.start.saturating_adjust(adjust),
                self.end.saturating_adjust(adjust),
            ),
        };

        Some(Self { start, end })
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
    use crate::SheetId;

    use super::*;

    #[test]
    fn test_adjust() {
        // Test single cell translation
        let range = RefRangeBounds::test_a1("A1");
        let adj = RefAdjust::new_translate(1, 1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "B2");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "B2");

        // Test range translation
        let range = RefRangeBounds::test_a1("A1:C3");
        let adj = RefAdjust::new_translate(1, 1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "B2:D4");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "B2:D4");

        // Test column range translation doesn't change
        let range = RefRangeBounds::test_a1("A:C");
        let adj = RefAdjust::new_translate(1, 0);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "A:C");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "A:C");

        // Test row range translation doesn't change
        let range = RefRangeBounds::test_a1("1:3");
        let adj = RefAdjust::new_translate(0, 1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "1:3");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "1:3");

        // Test negative translation
        let range = RefRangeBounds::test_a1("B2:D4");
        let adj = RefAdjust::new_translate(-1, -1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "A1:C3");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "A1:C3");

        // Test zero translation
        let range = RefRangeBounds::test_a1("A1:C3");
        let adj = RefAdjust::new_translate(0, 0);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "A1:C3");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "A1:C3");

        // Ideally * remains unchanged
        let range = RefRangeBounds::test_a1("*");
        let adj = RefAdjust::new_translate(1, 1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "*");
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "*");

        // Test negative translation capping
        let range = RefRangeBounds::test_a1("A12:Z12");
        let adj = RefAdjust::new_translate(-10, -10);
        range.adjust(adj).unwrap_err();
        assert_eq!(range.saturating_adjust(adj).unwrap().to_string(), "A2:P2");
    }

    #[test]
    fn test_adjust_column_row() {
        let sheet_id = SheetId::TEST;

        let range = RefRangeBounds::test_a1("B3");
        let adj = RefAdjust::new_insert_column(sheet_id, 2);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "C3");

        let range = RefRangeBounds::test_a1("B3");
        let adj = RefAdjust::new_insert_row(sheet_id, 2);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "B4");

        let range = RefRangeBounds::test_a1("B3");
        let adj = RefAdjust::new_insert_column(sheet_id, 3);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "B3");

        let range = RefRangeBounds::test_a1("B3");
        let adj = RefAdjust::new_insert_row(sheet_id, 4);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "B3");

        let range = RefRangeBounds::test_a1("B3");
        let adj = RefAdjust::new_delete_column(sheet_id, 1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "A3");

        let range = RefRangeBounds::test_a1("B3");
        let adj = RefAdjust::new_delete_row(sheet_id, 1);
        assert_eq!(range.adjust(adj).unwrap().to_string(), "B2");
    }
}
