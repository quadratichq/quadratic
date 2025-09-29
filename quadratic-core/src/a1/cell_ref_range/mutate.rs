use crate::{RefAdjust, RefError};

use super::*;

impl CellRefRange {
    /// Adjusts coordinates by `adjust`. Returns an error if the result is out
    /// of bounds.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    pub(crate) fn adjust(self, adjust: RefAdjust) -> Result<Self, RefError> {
        match self {
            Self::Sheet { range } => Ok(Self::Sheet {
                range: range.adjust(adjust)?,
            }),
            other => Ok(other),
        }
    }

    /// Adjusts coordinates by `adjust`, clamping the result within the sheet
    /// bounds. Returns `None` if the result is empty.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub(crate) fn saturating_adjust(self, adjust: RefAdjust) -> Option<Self> {
        match self {
            CellRefRange::Sheet { range } => Some(Self::Sheet {
                range: range.saturating_adjust(adjust)?,
            }),
            other => Some(other),
        }
    }

    /// Translates the range by the given delta, clamping the result within the
    /// sheet bounds. Returns `None` if the result is empty. Returns a new
    /// CellRefRange.
    #[cfg(test)]
    pub(crate) fn translate(self, dx: i64, dy: i64) -> Option<Self> {
        match self {
            CellRefRange::Sheet { range } => Some(Self::Sheet {
                range: range.translate_unchecked(dx, dy),
            }),
            other => Some(other),
        }
    }

    /// Translates the range by the given delta, clamping the result within the
    /// sheet bounds. Returns a new CellRefRange.
    pub(crate) fn saturating_translate(self, dx: i64, dy: i64) -> Option<Self> {
        match self {
            CellRefRange::Sheet { range } => {
                let adjust = RefAdjust::new_translate(dx, dy);
                range
                    .saturating_adjust(adjust)
                    .map(|new_range| Self::Sheet { range: new_range })
            }
            other => Some(other),
        }
    }

    /// Replaces a table name in the range.
    pub(crate) fn replace_table_name(&mut self, old_name: &str, new_name: &str) {
        match self {
            Self::Sheet { .. } => {}
            Self::Table { range } => {
                range.replace_table_name(old_name, new_name);
            }
        }
    }

    /// Replaces a table column name in the range.
    pub(crate) fn replace_column_name(&mut self, table_name: &str, old_name: &str, new_name: &str) {
        match self {
            Self::Sheet { .. } => {}
            Self::Table { range } => {
                range.replace_column_name(table_name, old_name, new_name);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn test_adjust_translate() {
        // Test single cell translation
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.adjust(RefAdjust::new_translate(1, 2)).unwrap();
        assert_eq!(translated.to_string(), "B3");
        assert_eq!(translated, CellRefRange::test_a1("B3"));

        // Test range translation
        let range = CellRefRange::test_a1("A1:B2");
        let translated = range.adjust(RefAdjust::new_translate(2, 1)).unwrap();
        assert_eq!(translated.to_string(), "C2:D3");
        assert_eq!(translated, CellRefRange::test_a1("C2:D3"));

        // Test column range translation doesn't change
        let col_range = CellRefRange::test_a1("A:B");
        let translated = col_range.adjust(RefAdjust::new_translate(1, 0)).unwrap();
        assert_eq!(translated.to_string(), "A:B");
        assert_eq!(translated, CellRefRange::test_a1("A:B"));

        // Test row range translation doesn't change
        let row_range = CellRefRange::test_a1("1:2");
        let translated = row_range.adjust(RefAdjust::new_translate(0, 2)).unwrap();
        assert_eq!(translated.to_string(), "1:2");
        assert_eq!(translated, CellRefRange::test_a1("1:2"));

        // Test negative translation capping
        let cell = CellRefRange::test_a1("A1");
        cell.adjust(RefAdjust::new_translate(-10, -10)).unwrap_err();
    }

    #[test]
    fn test_adjust_column_row() {
        let sheet_id = SheetId::TEST;

        let range = CellRefRange::test_a1("B3");
        let res = range.adjust(RefAdjust::new_insert_column(sheet_id, 2));
        assert_eq!(res.unwrap().to_string(), "C3");

        let range = CellRefRange::test_a1("B3");
        let res = range.adjust(RefAdjust::new_insert_row(sheet_id, 2));
        assert_eq!(res.unwrap().to_string(), "B4");

        let range = CellRefRange::test_a1("B3");
        let res = range.adjust(RefAdjust::new_insert_column(sheet_id, 3));
        assert_eq!(res.unwrap().to_string(), "B3");

        let range = CellRefRange::test_a1("B3");
        let res = range.adjust(RefAdjust::new_insert_row(sheet_id, 4));
        assert_eq!(res.unwrap().to_string(), "B3");

        let range = CellRefRange::test_a1("B3");
        let res = range.adjust(RefAdjust::new_delete_column(sheet_id, 1));
        assert_eq!(res.unwrap().to_string(), "A3");

        let range = CellRefRange::test_a1("B3");
        let res = range.adjust(RefAdjust::new_delete_row(sheet_id, 1));
        assert_eq!(res.unwrap().to_string(), "B2");
    }

    #[test]
    fn test_translate() {
        // Test single cell translation
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.translate(1, 2).unwrap();
        assert_eq!(translated.to_string(), "B3");
        assert_eq!(translated, CellRefRange::test_a1("B3"));

        // Test range translation
        let range = CellRefRange::test_a1("A1:B2");
        let translated = range.translate(2, 1).unwrap();
        assert_eq!(translated.to_string(), "C2:D3");
        assert_eq!(translated, CellRefRange::test_a1("C2:D3"));

        // Test column range translation
        let col_range = CellRefRange::test_a1("A:B");
        let translated = col_range.translate(1, 0).unwrap();
        assert_eq!(translated.to_string(), "B:C");
        assert_eq!(translated, CellRefRange::test_a1("B:C"));

        // Test row range translation
        let row_range = CellRefRange::test_a1("1:2");
        let translated = row_range.translate(0, 2).unwrap();
        assert_eq!(translated.to_string(), "3:4");
        assert_eq!(translated, CellRefRange::test_a1("3:4"));

        // Test negative translation
        let cell = CellRefRange::test_a1("C3");
        let translated = cell.translate(-1, -2).unwrap();
        assert_eq!(translated.to_string(), "B1");
        assert_eq!(translated, CellRefRange::test_a1("B1"));
    }

    #[test]
    fn test_saturating_translate() {
        // Test single cell translation
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.saturating_translate(1, 2).unwrap();
        assert_eq!(translated.to_string(), "B3");
        assert_eq!(translated, CellRefRange::test_a1("B3"));

        // Test range translation
        let range = CellRefRange::test_a1("A1:B2");
        let translated = range.saturating_translate(2, 1).unwrap();
        assert_eq!(translated.to_string(), "C2:D3");
        assert_eq!(translated, CellRefRange::test_a1("C2:D3"));

        // Test column range translation doesn't change
        let col_range = CellRefRange::test_a1("A:B");
        let translated = col_range.saturating_translate(1, 0).unwrap();
        assert_eq!(translated.to_string(), "A:B");
        assert_eq!(translated, CellRefRange::test_a1("A:B"));

        // Test row range translation doesn't change
        let row_range = CellRefRange::test_a1("1:2");
        let translated = row_range.saturating_translate(0, 2).unwrap();
        assert_eq!(translated.to_string(), "1:2");
        assert_eq!(translated, CellRefRange::test_a1("1:2"));

        // Test negative translation
        let cell = CellRefRange::test_a1("C3");
        let translated = cell.saturating_translate(-1, -2).unwrap();
        assert_eq!(translated.to_string(), "B1");
        assert_eq!(translated, CellRefRange::test_a1("B1"));

        // Test translation that would go out of bounds
        let cell = CellRefRange::test_a1("A1");
        let translated = cell.saturating_translate(-10, -10);
        assert!(translated.is_none());
    }
}
