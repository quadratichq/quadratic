use crate::a1::{A1Context, ColRange, RowRange, TableRef};

use super::*;

impl A1Selection {
    /// Selects a table.
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        append: bool,
        context: &A1Context,
        screen_row_top: i64,
    ) {
        let Some(table) = context.try_table(table_name) else {
            return;
        };

        let (col_range, x) = if let Some(col) = col {
            if let Some(col_index) = table.try_col_index(&col) {
                (
                    ColRange::Col(table.visible_columns[col_index as usize].clone()),
                    col_index + table.bounds.min.x,
                )
            } else {
                return;
            }
        } else {
            (ColRange::All, table.bounds.min.x)
        };

        if !append {
            self.ranges.clear();
        }
        let table_ref = TableRef {
            table_name: table_name.to_string(),
            data: true,
            headers: false,
            totals: false,
            row_range: RowRange::All,
            col_range,
        };
        self.ranges.push(CellRefRange::Table { range: table_ref });
        self.cursor = Pos {
            x,
            y: if table.bounds.min.y < screen_row_top {
                screen_row_top
            } else {
                table.bounds.min.y + if table.bounds.height() == 1 { 0 } else { 1 }
            },
        };
        self.sheet_id = table.sheet_id;
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{a1::RefRangeBounds, Rect};

    use super::*;

    #[test]
    fn test_select_table() {
        let context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, false, &context, 1);
        assert_eq!(selection.ranges.len(), 1);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table {
                range: TableRef::new("Table1"),
            }
        );
        assert_eq!(selection.cursor, pos!(A1));
    }

    #[test]
    fn test_select_table_col() {
        let context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", Some("Col1".to_string()), false, &context, 1);
        assert_eq!(selection.ranges.len(), 1);
        let table_ref = TableRef {
            table_name: "Table1".to_string(),
            data: true,
            headers: false,
            totals: false,
            row_range: RowRange::All,
            col_range: ColRange::Col("Col1".to_string()),
        };
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table { range: table_ref }
        );
        assert_eq!(selection.cursor, pos!(A1));
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "Table1[Col1]"
        );
    }

    #[test]
    fn test_select_table_append() {
        let context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, true, &context, 1);
        assert_eq!(selection.ranges.len(), 2);
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Sheet {
                range: RefRangeBounds::test_a1("A1"),
            }
        );
        assert_eq!(
            selection.ranges[1],
            CellRefRange::Table {
                range: TableRef::new("Table1"),
            }
        );
        assert_eq!(selection.cursor, pos!(A1));
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "A1,Table1"
        );
    }

    #[test]
    fn test_select_table_append_col() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["Col1", "Col2"], Rect::test_a1("A1:B3"))],
        );
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, false, &context, 1);
        selection.select_table("Table1", Some("Col1".to_string()), false, &context, 1);
        assert_eq!(selection.ranges.len(), 1);
        let table_ref = TableRef {
            table_name: "Table1".to_string(),
            data: true,
            headers: false,
            totals: false,
            row_range: RowRange::All,
            col_range: ColRange::Col("Col1".to_string()),
        };
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table { range: table_ref }
        );
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "Table1[Col1]"
        );

        assert_eq!(selection.cursor, pos!(A2));
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", Some("Col2".to_string()), true, &context, 1);
        assert_eq!(selection.ranges.len(), 2);
        let table_ref = TableRef {
            table_name: "Table1".to_string(),
            data: true,
            headers: false,
            totals: false,
            row_range: RowRange::All,
            col_range: ColRange::Col("Col2".to_string()),
        };
        assert_eq!(
            selection.ranges[1],
            CellRefRange::Table { range: table_ref }
        );
        assert_eq!(selection.cursor, pos!(B2));
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "A1,Table1[Col2]"
        );
    }

    #[test]
    fn test_select_table_screen_row_bounds() {
        let context = A1Context::test(&[], &[("Table1", &["Col1"], Rect::test_a1("A5:B100"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, false, &context, 10);
        assert_eq!(selection.cursor, pos!(A10));

        selection.select_table("Table1", None, false, &context, 3);
        assert_eq!(selection.cursor, pos!(A6));
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "Table1"
        );
    }
}
