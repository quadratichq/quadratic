use serde::{Deserialize, Serialize};

use crate::{
    Pos, Rect, SheetPos,
    grid::{CodeCellLanguage, DataTable, SheetId},
};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableMapEntry {
    pub sheet_id: SheetId,
    pub table_name: String,
    pub visible_columns: Vec<String>,
    pub all_columns: Vec<String>,
    pub bounds: Rect,
    pub show_name: bool,
    pub show_columns: bool,
    pub is_html_image: bool,
    pub header_is_first_row: bool,
    pub language: CodeCellLanguage,
}

impl TableMapEntry {
    pub(crate) fn from_table(sheet_id: SheetId, pos: Pos, table: &DataTable) -> Self {
        if table.has_spill() || table.has_error() {
            Self {
                sheet_id,
                table_name: table.name().to_string(),
                visible_columns: table.columns_map(false),
                all_columns: table.columns_map(true),
                bounds: table.output_rect(pos, false),
                show_name: false,
                show_columns: false,
                is_html_image: false,
                header_is_first_row: false,
                language: table.get_language(),
            }
        } else {
            Self {
                sheet_id,
                table_name: table.name().to_string(),
                visible_columns: table.columns_map(false),
                all_columns: table.columns_map(true),
                bounds: table.output_rect(pos, false),
                show_name: table.get_show_name(),
                show_columns: table.get_show_columns(),
                is_html_image: table.is_html() || table.is_image(),
                header_is_first_row: table.header_is_first_row,
                language: table.get_language(),
            }
        }
    }

    /// Returns the start and end of the table in row coordinates relative to
    /// the sheet.
    pub(crate) fn to_sheet_rows(&self) -> (i64, i64) {
        (self.bounds.min.y, self.bounds.max.y)
    }

    /// Tries to get the visible_columns index for the given column name.
    /// Returns None if the range is not visible or no longer exists.
    ///
    /// Note: the index does not include the table's column offset.
    pub(crate) fn try_col_index(&self, col: &str) -> Option<i64> {
        let index = self
            .visible_columns
            .iter()
            .position(|c| c.to_lowercase() == col.to_lowercase())?;
        Some(index as i64)
    }

    /// Returns the col_index if visible, otherwise returns the closest visible
    /// column index either after or before the hidden one. Returns None if there are none.
    ///
    /// Note: the index does not include the table's column offset.
    pub(crate) fn try_col_closest(&self, col: &str, after: bool) -> Option<i64> {
        if let Some(index) = self.try_col_index(col) {
            // If the column is visible, return its index
            Some(index)
        } else {
            // Find position in all_columns
            let all_col_pos = self
                .all_columns
                .iter()
                .position(|c| c.to_lowercase() == col.to_lowercase())?;

            if after {
                // Find first visible column after this position
                for i in all_col_pos..self.all_columns.len() {
                    let col = &self.all_columns[i];
                    if let Some(vis_pos) = self
                        .visible_columns
                        .iter()
                        .position(|c| c.to_lowercase() == col.to_lowercase())
                    {
                        return Some(vis_pos as i64);
                    }
                }

                // If no visible columns after, return last visible column
                if !self.visible_columns.is_empty() {
                    Some((self.visible_columns.len() - 1) as i64)
                } else {
                    None
                }
            } else {
                // Find first visible column before this position
                for i in (0..all_col_pos).rev() {
                    let col = &self.all_columns[i];
                    if let Some(vis_pos) = self
                        .visible_columns
                        .iter()
                        .position(|c| c.to_lowercase() == col.to_lowercase())
                    {
                        return Some(vis_pos as i64);
                    }
                }

                // If no visible columns before, return first visible column
                if !self.visible_columns.is_empty() {
                    Some(0)
                } else {
                    None
                }
            }
        }
    }

    /// Tries to get the range for the given column range. Returns None if the
    /// range is not visible or no longer exists.
    ///
    /// Note: the index does not include the table's column offset.
    pub(crate) fn try_col_range(&self, col1: &str, col2: &str) -> Option<(i64, i64)> {
        // Get closest visible columns for start and end
        let start = self.try_col_closest(col1, true)?;
        let end = self.try_col_closest(col2, false)?;

        // Return range between closest visible columns, ensuring start <= end
        Some((start.min(end), start.max(end)))
    }

    /// Tries to get the range for the given column range. Returns None if the
    /// range is not visible or no longer exists.
    ///
    /// Note: the index does not include the table's column offset.
    pub(crate) fn try_col_range_to_end(&self, col: &str) -> Option<(i64, i64)> {
        let start = self.try_col_closest(col, true)?;
        let end = (self.visible_columns.len() - 1) as i64;
        Some((start, end))
    }

    /// Returns true if the table contains the given position.
    pub(crate) fn contains(&self, pos: SheetPos) -> bool {
        self.sheet_id == pos.sheet_id && self.bounds.contains(pos.into())
    }

    /// Returns the column name from the index.
    pub(crate) fn col_name_from_index(&self, index: usize) -> Option<String> {
        self.visible_columns.get(index).cloned()
    }

    /// Returns the y adjustment for the table to account for the UI elements.
    pub(crate) fn y_adjustment(&self, adjust_for_header_is_first_row: bool) -> i64 {
        let mut y_adjustment = 0;

        if self.show_name {
            y_adjustment += 1;
        }

        if !self.is_html_image && self.show_columns {
            y_adjustment += 1;
        }

        if self.header_is_first_row && adjust_for_header_is_first_row {
            y_adjustment -= 1;
        }

        y_adjustment
    }

    #[cfg(test)]
    pub(crate) fn test(
        table_name: &str,
        visible_columns: &[&str],
        all_columns: Option<&[&str]>,
        bounds: Rect,
        language: CodeCellLanguage,
    ) -> Self {
        let visible_columns: Vec<String> = visible_columns.iter().map(|c| c.to_string()).collect();
        let all_columns: Vec<String> = all_columns.map_or(visible_columns.clone(), |c| {
            c.iter().map(|c| c.to_string()).collect()
        });
        TableMapEntry {
            sheet_id: SheetId::TEST,
            table_name: table_name.to_string(),
            visible_columns,
            all_columns,
            bounds,
            show_name: true,
            show_columns: true,
            is_html_image: false,
            header_is_first_row: false,
            language,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_try_col_index() {
        let entry = TableMapEntry::test(
            "test_table",
            &["Col1", "Col2", "Col3"],
            None,
            Rect::test_a1("A1:D4"),
            CodeCellLanguage::Import,
        );

        assert_eq!(entry.try_col_index("Col1"), Some(0));
        assert_eq!(entry.try_col_index("col1"), Some(0)); // Case insensitive
        assert_eq!(entry.try_col_index("Col2"), Some(1));
        assert_eq!(entry.try_col_index("Col3"), Some(2));
        assert_eq!(entry.try_col_index("Col4"), None);
    }

    #[test]
    fn test_try_col_closest() {
        let entry = TableMapEntry::test(
            "test_table",
            &["Col1", "Col3", "Col5"],
            Some(&["Col1", "Col2", "Col3", "Col4", "Col5"]),
            Rect::test_a1("A1:D4"),
            CodeCellLanguage::Import,
        );

        // Test visible columns
        assert_eq!(entry.try_col_closest("Col1", true), Some(0));
        assert_eq!(entry.try_col_closest("Col3", true), Some(1));

        // Test hidden columns
        assert_eq!(entry.try_col_closest("Col2", true), Some(1)); // Next visible after Col2 is Col3
        assert_eq!(entry.try_col_closest("Col2", false), Some(0)); // Previous visible before Col2 is Col1
        assert_eq!(entry.try_col_closest("Col4", true), Some(2)); // Next visible after Col4 is Col5
        assert_eq!(entry.try_col_closest("Col4", false), Some(1)); // Previous visible before Col4 is Col3
    }

    #[test]
    fn test_try_col_range() {
        let entry = TableMapEntry::test(
            "test_table",
            &["Col1", "Col3", "Col5"],
            Some(&["Col1", "Col2", "Col3", "Col4", "Col5"]),
            Rect::test_a1("A1:D4"),
            CodeCellLanguage::Import,
        );

        assert_eq!(entry.try_col_range("Col1", "Col5"), Some((0, 2)));
        assert_eq!(entry.try_col_range("Col2", "Col4"), Some((1, 1))); // Both hidden, uses closest visible
        assert_eq!(entry.try_col_range("Col5", "Col1"), Some((0, 2))); // Reversed order works
    }

    #[test]
    fn test_y_adjustment() {
        let mut entry = TableMapEntry::test(
            "test_table",
            &["Col1"],
            None,
            Rect::test_a1("A1:D4"),
            CodeCellLanguage::Import,
        );

        // Default settings (show_ui = true, show_name = true, show_columns = true)
        assert_eq!(entry.y_adjustment(false), 2);

        // Hide UI
        entry.show_name = false;
        entry.show_columns = false;
        assert_eq!(entry.y_adjustment(false), 0);

        // Test header_is_first_row
        entry.header_is_first_row = true;
        assert_eq!(entry.y_adjustment(true), -1);
        assert_eq!(entry.y_adjustment(false), 0);
    }

    #[test]
    fn test_contains() {
        let entry = TableMapEntry::test(
            "test_table",
            &["Col1"],
            None,
            Rect::test_a1("A1:C4"),
            CodeCellLanguage::Import,
        );

        assert!(entry.contains(SheetPos::new(entry.sheet_id, 2, 2)));
        assert!(!entry.contains(SheetPos::new(entry.sheet_id, 0, 0)));
        assert!(!entry.contains(SheetPos::new(SheetId::new(), 2, 2))); // Different sheet
    }
}
