use crate::{a1::A1Context, Pos, Rect};

use super::*;

impl TableRef {
    /// Returns true if the table intersects the rectangle.
    pub fn intersect_rect(&self, rect: Rect, context: &A1Context) -> bool {
        let Some(table) = context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.intersects(rect)
    }

    /// Returns whether the table contains the position.
    pub fn contains(&self, pos: Pos, context: &A1Context) -> bool {
        let Some(table) = context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.contains(pos) && self.col_range.has_col(pos.x - table.bounds.min.x, table)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::grid::SheetId;

    use super::*;

    fn setup_test_context() -> (A1Context, SheetId) {
        let sheet_id = SheetId::test();

        let mut context = A1Context::default();
        context
            .table_map
            .test_insert("test_table", &["A", "B", "C"], None, Rect::test_a1("A1:C3"));

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