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
    ) {
        let Some(table) = context.try_table(table_name) else {
            return;
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
            col_range: if let Some(col) = col {
                ColRange::Col(col)
            } else {
                ColRange::All
            },
        };
        self.ranges.push(CellRefRange::Table { range: table_ref });
        self.cursor = table.bounds.min;
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
        selection.select_table("Table1", None, false, &context);
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
        selection.select_table("Table1", Some("Col1".to_string()), false, &context);
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
    }

    #[test]
    fn test_select_table_append() {
        let context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, true, &context);
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
    }

    #[test]
    fn test_select_table_append_col() {
        let context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, false, &context);
        selection.select_table("Table1", Some("Col1".to_string()), false, &context);
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

        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", Some("Col2".to_string()), true, &context);
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
    }
}
