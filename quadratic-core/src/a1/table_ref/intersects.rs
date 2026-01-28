use crate::{Pos, Rect, a1::A1Context};

use super::*;

impl TableRef {
    /// Returns true if the table intersects the rectangle.
    pub fn intersect_rect(&self, rect: Rect, a1_context: &A1Context) -> bool {
        let Some(table) = a1_context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.intersects(rect)
    }

    /// Returns whether the table contains the position.
    pub fn contains(&self, pos: Pos, a1_context: &A1Context) -> bool {
        let Some(table) = a1_context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.contains(pos) && self.col_range.has_col(pos.x - table.bounds.min.x, table)
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::{CodeCellLanguage, SheetId};

    use super::*;

    fn setup_test_context() -> (A1Context, SheetId) {
        let sheet_id = SheetId::TEST;

        let mut context = A1Context::default();
        context.table_map.test_insert(
            "test_table",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C3"),
            CodeCellLanguage::Import,
        );

        (context, sheet_id)
    }

    #[test]
    fn test_intersect_rect() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        // Intersecting rectangle
        assert!(table_ref.intersect_rect(Rect::test_a1("A1:B2"), &context));

        // Non-intersecting rectangle
        assert!(!table_ref.intersect_rect(Rect::new(10, 10, 11, 11), &context));
    }

    #[test]
    fn test_contains_invalid_table_name() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "nonexistent_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        // Should return false for any position when table doesn't exist
        assert!(!table_ref.contains(pos![A1], &context));
        assert!(!table_ref.contains(pos![B2], &context));
        assert!(!table_ref.contains(Pos::new(10, 10), &context));
    }

    #[test]
    fn test_contains_col_all() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        // All positions within table bounds should be contained
        assert!(table_ref.contains(pos![A1], &context));
        assert!(table_ref.contains(pos![B2], &context));
        assert!(table_ref.contains(pos![C3], &context));

        // Positions outside table bounds should not be contained
        assert!(!table_ref.contains(pos![D1], &context));
        assert!(!table_ref.contains(pos![A4], &context));
        assert!(!table_ref.contains(Pos::new(10, 10), &context));
    }

    #[test]
    fn test_contains_single_col() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        // Positions within column B
        assert!(table_ref.contains(pos![B1], &context));
        assert!(table_ref.contains(pos![B2], &context));
        assert!(table_ref.contains(pos![B3], &context));

        // Positions in other columns within table
        assert!(!table_ref.contains(pos![A1], &context));
        assert!(!table_ref.contains(pos![C1], &context));

        // Positions outside table bounds
        assert!(!table_ref.contains(pos![B4], &context));
        assert!(!table_ref.contains(Pos::new(10, 10), &context));
    }

    #[test]
    fn test_contains_col_range() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        // Positions within columns A and B
        assert!(table_ref.contains(pos![A1], &context));
        assert!(table_ref.contains(pos![A3], &context));
        assert!(table_ref.contains(pos![B1], &context));
        assert!(table_ref.contains(pos![B3], &context));

        // Positions in column C (outside range)
        assert!(!table_ref.contains(pos![C1], &context));
        assert!(!table_ref.contains(pos![C3], &context));

        // Positions outside table bounds
        assert!(!table_ref.contains(pos![A4], &context));
        assert!(!table_ref.contains(Pos::new(10, 10), &context));
    }

    #[test]
    fn test_contains_col_to_end() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        // Positions in columns B and C (B to end)
        assert!(table_ref.contains(pos![B1], &context));
        assert!(table_ref.contains(pos![B3], &context));
        assert!(table_ref.contains(pos![C1], &context));
        assert!(table_ref.contains(pos![C3], &context));

        // Positions in column A (before range start)
        assert!(!table_ref.contains(pos![A1], &context));
        assert!(!table_ref.contains(pos![A3], &context));

        // Positions outside table bounds
        assert!(!table_ref.contains(pos![B4], &context));
        assert!(!table_ref.contains(Pos::new(10, 10), &context));
    }

    #[test]
    fn test_contains_invalid_column_name() {
        let (context, _) = setup_test_context();

        // Single invalid column
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Z".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.contains(pos![A1], &context));
        assert!(!table_ref.contains(pos![B2], &context));

        // Invalid column range
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("X".to_string(), "Z".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.contains(pos![A1], &context));
        assert!(!table_ref.contains(pos![B2], &context));

        // Invalid column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("Z".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.contains(pos![A1], &context));
        assert!(!table_ref.contains(pos![B2], &context));
    }
}
