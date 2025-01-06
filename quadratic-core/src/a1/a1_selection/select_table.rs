use crate::a1::{A1Context, ColRange, RowRange, TableRef};

use super::*;

impl A1Selection {
    /// Selects a table.
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        context: &A1Context,
        screen_row_top: i64,
        shift_key: bool,
        ctrl_key: bool,
    ) {
        let Some(table) = context.try_table(table_name) else {
            return;
        };

        // Check for row range selection w/shift key
        let last = self.ranges.last().cloned();
        if shift_key {
            if let Some(col) = &col {
                if let Some(CellRefRange::Table { range: table_ref }) = last {
                    if table_ref.table_name == table_name && table_ref.row_range == RowRange::All {
                        match &table_ref.col_range {
                            ColRange::ColRange(start, end) => {
                                // if we already have a range, then we change the end to the new col
                                if end == col {
                                    return;
                                }
                                self.ranges.pop();
                                let table_ref = TableRef {
                                    table_name: table_name.to_string(),
                                    data: true,
                                    headers: false,
                                    totals: false,
                                    row_range: RowRange::All,
                                    col_range: ColRange::ColRange(start.clone(), col.clone()),
                                };
                                self.ranges.push(CellRefRange::Table { range: table_ref });
                                return;
                            }
                            ColRange::Col(existing_col) => {
                                // if we have a single col selected, then we
                                // create a range from that column to the new
                                // col
                                if col == existing_col {
                                    return;
                                }
                                self.ranges.pop();
                                let table_ref = TableRef {
                                    table_name: table_name.to_string(),
                                    data: true,
                                    headers: false,
                                    totals: false,
                                    row_range: RowRange::All,
                                    col_range: ColRange::ColRange(
                                        existing_col.clone(),
                                        col.clone(),
                                    ),
                                };
                                self.ranges.push(CellRefRange::Table { range: table_ref });
                                return;
                            }
                            ColRange::ColToEnd(existing_col) => {
                                // If we have col to end, then we change it to a
                                // range (or a single col if it's the same)
                                self.ranges.pop();
                                if col == existing_col {
                                    let table_ref = TableRef {
                                        table_name: table_name.to_string(),
                                        data: true,
                                        headers: false,
                                        totals: false,
                                        row_range: RowRange::All,
                                        col_range: ColRange::Col(col.clone()),
                                    };
                                    self.ranges.push(CellRefRange::Table { range: table_ref });
                                    return;
                                } else {
                                    let table_ref = TableRef {
                                        table_name: table_name.to_string(),
                                        data: true,
                                        headers: false,
                                        totals: false,
                                        row_range: RowRange::All,
                                        col_range: ColRange::ColRange(
                                            existing_col.clone(),
                                            col.clone(),
                                        ),
                                    };
                                    self.ranges.push(CellRefRange::Table { range: table_ref });
                                    return;
                                }
                            }
                            ColRange::All => {
                                // if we have all cols selected, then we remove it
                                self.ranges.pop();
                            }
                        }
                    }
                }
            }
        }

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

        // toggle headers if selecting the same column twice w/nothing else
        // selected
        let mut headers = false;
        if !shift_key && !ctrl_key && self.ranges.len() == 1 {
            if let Some(CellRefRange::Table { range }) = self.ranges.last() {
                if range.table_name == table_name
                    && range.col_range == col_range
                    && matches!(col_range, ColRange::Col(_))
                {
                    headers = !range.headers;
                    self.ranges.pop();
                }
            }
        };

        if !shift_key && !ctrl_key {
            self.ranges.clear();
        }

        let table_ref = TableRef {
            table_name: table_name.to_string(),
            data: true,
            headers,
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
                table.bounds.min.y
                    + if headers || table.bounds.height() == 1 {
                        0
                    } else {
                        1
                    }
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
        selection.select_table("Table1", None, &context, 1, false, false);
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
        selection.select_table(
            "Table1",
            Some("Col1".to_string()),
            &context,
            1,
            false,
            false,
        );
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
        selection.select_table("Table1", None, &context, 1, true, false);
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
        selection.select_table("Table1", None, &context, 1, false, false);
        selection.select_table(
            "Table1",
            Some("Col1".to_string()),
            &context,
            1,
            false,
            false,
        );
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
        selection.select_table("Table1", Some("Col2".to_string()), &context, 1, true, false);
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
        selection.select_table("Table1", None, &context, 10, false, false);
        assert_eq!(selection.cursor, pos!(A10));

        selection.select_table("Table1", None, &context, 3, false, false);
        assert_eq!(selection.cursor, pos!(A6));
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &context),
            "Table1"
        );
    }
}
