use crate::{Pos, Rect, a1::A1Context};

use super::*;

impl TableRef {
    /// Returns true if the table intersects the rectangle.
    pub(crate) fn intersect_rect(&self, rect: Rect, a1_context: &A1Context) -> bool {
        let Some(table) = a1_context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.intersects(rect)
    }

    /// Returns whether the table contains the position.
    pub(crate) fn contains(&self, pos: Pos, a1_context: &A1Context) -> bool {
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
    fn test_contains() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        // Position within column A
        assert!(table_ref.contains(pos![A1], &context));
        assert!(table_ref.contains(pos![A1], &context));

        // Position outside column A
        assert!(!table_ref.contains(pos![B1], &context));
        assert!(!table_ref.contains(pos![C1], &context));

        // Position completely outside table
        assert!(!table_ref.contains(Pos::new(10, 10), &context));
    }
}
