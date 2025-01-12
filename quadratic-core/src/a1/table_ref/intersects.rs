use crate::{a1::A1Context, Pos, Rect};

use super::*;

impl TableRef {
    pub fn intersect_rect(&self, rect: Rect, context: &A1Context) -> bool {
        let Some(table) = context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.intersects(rect)
    }

    pub fn contains_pos(&self, pos: Pos, context: &A1Context) -> bool {
        let Some(table) = context.try_table(&self.table_name) else {
            return false;
        };
        if !self.col_range.has_col(pos.x, table) {
            return false;
        }
        false
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
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        // Intersecting rectangle
        assert!(table_ref.intersect_rect(Rect::test_a1("A1:B2"), &context));

        // Non-intersecting rectangle
        assert!(!table_ref.intersect_rect(Rect::new(10, 10, 11, 11), &context));
    }
}
