//! Mutation methods that insert or delete columns and rows from a selection.

use crate::a1::{A1Context, CellRefRange, RefRangeBounds, TableRef};

use super::A1Selection;

impl A1Selection {
    /// Updates the cursor position to the position of the last range.
    pub fn update_cursor(&mut self, context: &A1Context) {
        if let Some(last) = self.ranges.last() {
            self.cursor = Self::cursor_pos_from_last_range(last, context);
        }
    }

    /// Potentially shrinks a selection after the removal of a column.
    /// A1Selection may have no ranges after the removal.
    pub fn removed_column(&mut self, column: i64, context: &A1Context) -> bool {
        let mut changed = false;

        self.ranges.retain_mut(|range| {
            if range.contains_only_column(column) {
                changed = true;
                false
            } else {
                if range.removed_column(column) {
                    changed = true;
                }
                true
            }
        });

        self.update_cursor(context);

        changed
    }

    /// Potentially shrinks a selection after the removal of a row.
    /// A1Selection may have no ranges after the removal.///
    pub fn removed_row(&mut self, row: i64, context: &A1Context) -> bool {
        let mut changed = false;

        self.ranges.retain_mut(|range| {
            if range.contains_only_row(row) {
                changed = true;
                false
            } else {
                if range.removed_row(row) {
                    changed = true;
                }
                true
            }
        });

        self.update_cursor(context);

        changed
    }

    /// Potentially shifts / grows a selection after the insertion of a column.
    pub fn inserted_column(&mut self, column: i64, context: &A1Context) -> bool {
        let mut changed = false;

        self.ranges.iter_mut().for_each(|range| {
            changed |= range.inserted_column(column);
        });

        self.update_cursor(context);

        changed
    }

    /// Potentially shifts / grows a selection after the insertion of a row.
    pub fn inserted_row(&mut self, row: i64, context: &A1Context) -> bool {
        let mut changed = false;

        self.ranges.iter_mut().for_each(|range| {
            changed |= range.inserted_row(row);
        });

        self.update_cursor(context);

        changed
    }

    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.cursor.translate_in_place(x, y, 1, 1);
        self.ranges.iter_mut().for_each(|range| {
            range.translate_in_place(x, y);
        });
    }

    pub fn translate(&self, x: i64, y: i64) -> Self {
        let mut selection = self.clone();
        selection.translate_in_place(x, y);
        selection
    }

    pub fn adjust_column_row_in_place(
        &mut self,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        self.cursor.adjust_column_row_in_place(column, row, delta);
        self.ranges.iter_mut().for_each(|range| {
            range.adjust_column_row_in_place(column, row, delta);
        });
    }

    /// Returns (vector of TableRef, vector of CellRefRange) contained within the selection.
    pub fn separate_table_ranges(&self) -> (Vec<RefRangeBounds>, Vec<TableRef>) {
        let mut sheet_ranges = Vec::new();
        let mut table_ranges = Vec::new();
        for range in self.ranges.iter() {
            match range {
                CellRefRange::Sheet { range } => sheet_ranges.push(*range),
                CellRefRange::Table { range } => table_ranges.push(range.clone()),
            }
        }
        (sheet_ranges, table_ranges)
    }

    pub fn replace_table_name(&mut self, old_name: &str, new_name: &str) {
        self.ranges.iter_mut().for_each(|range| {
            range.replace_table_name(old_name, new_name);
        });
    }

    pub fn replace_column_name(&mut self, old_name: &str, new_name: &str) {
        self.ranges.iter_mut().for_each(|range| {
            range.replace_column_name(old_name, new_name);
        });
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{grid::SheetId, Rect};

    use super::*;

    #[test]
    fn test_removed_column() {
        // Remove first column
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1:B2");
        assert!(selection.removed_column(1, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:A2"));

        // Remove single cell selection
        let mut selection = A1Selection::test_a1("A1");
        assert!(selection.removed_column(1, &context));
        assert!(selection.ranges.is_empty());

        // Basic removal of a column in the middle of a range
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(selection.removed_column(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        // Remove first column
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(selection.removed_column(1, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        // Remove last column
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(selection.removed_column(3, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        // Remove column outside range (no effect)
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(!selection.removed_column(4, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:C3"));

        // Multiple ranges with column removal
        let mut selection = A1Selection::test_a1("A1:C3,E1:G3");
        assert!(selection.removed_column(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B3,D1:F3"));

        // Remove column that causes range deletion
        let mut selection = A1Selection::test_a1("B1,C1:D1");
        assert!(selection.removed_column(2, &context));
        assert_eq!(selection, A1Selection::test_a1("B1:C1"));

        // Cursor adjustment when column is removed
        let mut selection = A1Selection::test_a1("D1");
        selection.cursor.x = 4; // D column
        assert!(selection.removed_column(2, &context));
        assert_eq!(selection.cursor.x, 3);

        // Cursor at column 1 stays at 1
        let mut selection = A1Selection::test_a1("A1");
        selection.cursor.x = 1;
        assert!(selection.removed_column(1, &context));
        assert_eq!(selection.cursor.x, 1);

        // Multiple ranges where some are completely removed
        let mut selection = A1Selection::test_a1("B1,C1,D1");
        assert!(selection.removed_column(2, &context));
        assert_eq!(selection, A1Selection::test_a1("B1,C1"));

        // Remove column that affects cursor but not ranges
        let mut selection = A1Selection::test_a1("A1:B3");
        selection.cursor.x = 4; // D column
        assert!(!selection.removed_column(3, &context));
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        let mut selection = A1Selection::test_a1("B2:B4,B2");
        assert!(selection.removed_column(2, &context));
        assert!(selection.ranges.is_empty());

        let mut selection = A1Selection::test_a1("A1:A1,A,2:5");
        assert!(selection.removed_column(1, &context));
        assert_eq!(selection, A1Selection::test_a1("2:5"));
    }

    #[test]
    fn test_removed_row() {
        let context = A1Context::default();
        // Basic removal of a row in a range
        let mut selection = A1Selection::test_a1("A1:B2");
        assert!(selection.removed_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B1"));

        // Remove single cell selection--returns cursor as range
        let mut selection = A1Selection::test_a1("A1");
        assert!(selection.removed_row(1, &context));
        assert!(selection.ranges.is_empty());

        // Remove row in the middle of a range
        let mut selection = A1Selection::test_a1("A1:B3");
        assert!(selection.removed_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B2"));

        // Remove first row
        let mut selection = A1Selection::test_a1("A1:B3");
        assert!(selection.removed_row(1, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B2"));

        // Remove last row
        let mut selection = A1Selection::test_a1("A1:B3");
        assert!(selection.removed_row(3, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B2"));

        // Remove row outside range (no effect)
        let mut selection = A1Selection::test_a1("A1:B3");
        assert!(!selection.removed_row(4, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        // Multiple ranges with row removal
        let mut selection = A1Selection::test_a1("A1:B3,A5:B7");
        assert!(selection.removed_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B2,A4:B6"));

        // Remove row that causes range deletion
        let mut selection = A1Selection::test_a1("A2,A3:A4");
        assert!(selection.removed_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A2:A3"));

        // Cursor adjustment when row is removed
        let mut selection = A1Selection::test_a1("A4");
        selection.cursor.y = 4;
        assert!(selection.removed_row(2, &context));
        assert_eq!(selection.cursor.y, 3);

        // Cursor at row 1 stays at 1
        let mut selection = A1Selection::test_a1("A1");
        selection.cursor.y = 1;
        assert!(selection.removed_row(1, &context));
        assert_eq!(selection.cursor.y, 1);

        // Multiple ranges where some are completely removed
        let mut selection = A1Selection::test_a1("A2,A3,A4");
        assert!(selection.removed_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A2,A3"));

        // Remove row that affects cursor but not ranges
        let mut selection = A1Selection::test_a1("A1:B3");
        selection.cursor.y = 4;
        assert!(!selection.removed_row(4, &context));
        assert_eq!(selection.cursor.y, 1);
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        let mut selection = A1Selection::test_a1("A2:C2,2");
        assert!(selection.removed_row(2, &context));
        assert!(selection.ranges.is_empty());

        let mut selection = A1Selection::test_a1("A1:A1,2,D:E");
        assert!(selection.removed_row(1, &context));
        assert_eq!(selection, A1Selection::test_a1("1,D:E"));
    }

    #[test]
    fn test_inserted_column() {
        // Insert before first column
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1:B2");
        assert!(selection.inserted_column(1, &context));
        assert_eq!(selection, A1Selection::test_a1("B1:C2"));

        // Insert in the middle of a range
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(selection.inserted_column(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:D3"));

        // Insert after last column in range
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(!selection.inserted_column(4, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:C3"));

        // Insert column affecting multiple ranges
        let mut selection = A1Selection::test_a1("A1:B2,D1:E2");
        assert!(selection.inserted_column(3, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B2,E1:F2"));

        // Insert at cursor position
        let mut selection = A1Selection::test_a1("A1");
        selection.cursor.x = 2; // B column
        assert!(!selection.inserted_column(2, &context));
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection, A1Selection::test_a1("A1"));

        // Insert affecting single-cell selection
        let mut selection = A1Selection::test_a1("C1");
        assert!(selection.inserted_column(2, &context));
        assert_eq!(selection, A1Selection::test_a1("D1"));

        // Insert affecting multiple single-cell selections
        let mut selection = A1Selection::test_a1("B1,D1,F1");
        assert!(selection.inserted_column(3, &context));
        assert_eq!(selection, A1Selection::test_a1("B1,E1,G1"));

        // Insert at column 1 (shifting everything right)
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(selection.inserted_column(1, &context));
        assert_eq!(selection, A1Selection::test_a1("B1:D3"));

        // Insert in large range
        let mut selection = A1Selection::test_a1("A1:Z3");
        assert!(selection.inserted_column(13, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:AA3"));

        // Insert affecting cursor but not ranges
        let mut selection = A1Selection::test_a1("A1:B3");
        selection.cursor.x = 4; // D column
        assert!(!selection.inserted_column(3, &context));
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));
    }

    #[test]
    fn test_inserted_row() {
        let context = A1Context::default();
        // Insert before first row
        let mut selection = A1Selection::test_a1("A1:B2");
        assert!(selection.inserted_row(1, &context));
        assert_eq!(selection, A1Selection::test_a1("A2:B3"));

        // Insert in the middle of a range
        let mut selection = A1Selection::test_a1("A1:B3");
        assert!(selection.inserted_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B4"));

        // Insert after last row in range
        let mut selection = A1Selection::test_a1("A1:B3");
        assert!(!selection.inserted_row(4, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));

        // Insert row affecting multiple ranges
        let mut selection = A1Selection::test_a1("A1:B2,A4:B5");
        assert!(selection.inserted_row(3, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:B2,A5:B6"));

        // Insert at cursor position
        let mut selection = A1Selection::test_a1("A1");
        selection.cursor.y = 2;
        assert!(!selection.inserted_row(2, &context));
        assert_eq!(selection.cursor.y, 1);
        assert_eq!(selection, A1Selection::test_a1("A1"));

        // Insert affecting single-cell selection
        let mut selection = A1Selection::test_a1("A3");
        assert!(selection.inserted_row(2, &context));
        assert_eq!(selection, A1Selection::test_a1("A4"));

        // Insert affecting multiple single-cell selections
        let mut selection = A1Selection::test_a1("A2,A4,A6");
        assert!(selection.inserted_row(3, &context));
        assert_eq!(selection, A1Selection::test_a1("A2,A5,A7"));

        // Insert at row 1 (shifting everything down)
        let mut selection = A1Selection::test_a1("A1:C3");
        assert!(selection.inserted_row(1, &context));
        assert_eq!(selection, A1Selection::test_a1("A2:C4"));

        // Insert in large range
        let mut selection = A1Selection::test_a1("A1:C20");
        assert!(selection.inserted_row(13, &context));
        assert_eq!(selection, A1Selection::test_a1("A1:C21"));

        // Insert affecting cursor but not ranges
        let mut selection = A1Selection::test_a1("A1:B3");
        selection.cursor.y = 4;
        assert!(!selection.inserted_row(4, &context));
        assert_eq!(selection.cursor.y, 1);
        assert_eq!(selection, A1Selection::test_a1("A1:B3"));
    }

    #[test]
    fn test_translate_in_place() {
        // Test positive translation
        let mut selection = A1Selection::test_a1("A1:B2");
        selection.translate_in_place(1, 1);
        assert_eq!(selection, A1Selection::test_a1("B2:C3"));

        // Test negative translation
        let mut selection = A1Selection::test_a1("C3:D4");
        selection.translate_in_place(-1, -1);
        assert_eq!(selection, A1Selection::test_a1("B2:C3"));

        // Test zero translation
        let mut selection = A1Selection::test_a1("A1:B2");
        selection.translate_in_place(0, 0);
        assert_eq!(selection, A1Selection::test_a1("A1:B2"));

        // Test x-only translation
        let mut selection = A1Selection::test_a1("A1:B2");
        selection.translate_in_place(2, 0);
        assert_eq!(selection, A1Selection::test_a1("C1:D2"));

        // Test y-only translation
        let mut selection = A1Selection::test_a1("A1:B2");
        selection.translate_in_place(0, 2);
        assert_eq!(selection, A1Selection::test_a1("A3:B4"));

        // Test single cell selection
        let mut selection = A1Selection::test_a1("A1");
        selection.translate_in_place(1, 1);
        assert_eq!(selection, A1Selection::test_a1("B2"));

        // Test negative translation capping
        let mut selection = A1Selection::test_a1("A1");
        selection.translate_in_place(-10, -10);
        assert_eq!(selection, A1Selection::test_a1("A1"));
    }

    #[test]
    fn test_translate() {
        // Test positive translation
        let selection = A1Selection::test_a1("A1:B2");
        let translated = selection.translate(1, 1);
        assert_eq!(translated, A1Selection::test_a1("B2:C3"));
        assert_eq!(selection, A1Selection::test_a1("A1:B2"));

        // Test negative translation
        let selection = A1Selection::test_a1("C3:D4");
        let translated = selection.translate(-1, -1);
        assert_eq!(translated, A1Selection::test_a1("B2:C3"));
        assert_eq!(selection, A1Selection::test_a1("C3:D4"));

        // Test zero translation
        let selection = A1Selection::test_a1("A1:B2");
        let translated = selection.translate(0, 0);
        assert_eq!(translated, A1Selection::test_a1("A1:B2"));
        assert_eq!(selection, A1Selection::test_a1("A1:B2"));

        // Test single cell selection
        let selection = A1Selection::test_a1("A1");
        let translated = selection.translate(1, 1);
        assert_eq!(translated, A1Selection::test_a1("B2"));
        assert_eq!(selection, A1Selection::test_a1("A1"));

        // Test negative translation capping
        let selection = A1Selection::test_a1("A1");
        let translated = selection.translate(-10, -10);
        assert_eq!(translated, A1Selection::test_a1("A1"));
        assert_eq!(selection, A1Selection::test_a1("A1"));
    }

    #[test]
    fn test_adjust_column_row() {
        let sheet_id = SheetId::test();
        let a1_context = A1Context::default();

        let mut selection = A1Selection::test_a1("B3");
        selection.adjust_column_row_in_place(Some(2), None, 1);
        assert_eq!(selection.to_string(Some(sheet_id), &a1_context), "C3");

        let mut selection = A1Selection::test_a1("B3");
        selection.adjust_column_row_in_place(None, Some(2), 1);
        assert_eq!(selection.to_string(Some(sheet_id), &a1_context), "B4");

        let mut selection = A1Selection::test_a1("B3");
        selection.adjust_column_row_in_place(Some(3), None, 1);
        assert_eq!(selection.to_string(Some(sheet_id), &a1_context), "B3");

        let mut selection = A1Selection::test_a1("B3");
        selection.adjust_column_row_in_place(None, Some(4), 1);
        assert_eq!(selection.to_string(Some(sheet_id), &a1_context), "B3");

        let mut selection = A1Selection::test_a1("B3");
        selection.adjust_column_row_in_place(Some(1), None, -1);
        assert_eq!(selection.to_string(Some(sheet_id), &a1_context), "A3");

        let mut selection = A1Selection::test_a1("B3");
        selection.adjust_column_row_in_place(None, Some(1), -1);
        assert_eq!(selection.to_string(Some(sheet_id), &a1_context), "B2");
    }

    #[test]
    fn test_separate_table_ranges() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["col1", "col2"], Rect::test_a1("A1:B2"))],
        );
        let selection = A1Selection::test_a1_context("D5,E5,Table1", &context);
        let (sheet_ranges, table_ranges) = selection.separate_table_ranges();
        assert_eq!(sheet_ranges.len(), 2);
        assert_eq!(table_ranges.len(), 1);
    }
}