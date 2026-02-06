use crate::a1::{A1Context, CellRefRangeEnd, ColRange, RefRangeBounds, TableRef};
use crate::grid::sheet::merge_cells::MergeCells;

use super::*;

impl A1Selection {
    /// Selects a table.
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        a1_context: &A1Context,
        screen_col_left: i64,
        shift_key: bool,
        ctrl_key: bool,
    ) {
        let Some(table) = a1_context.try_table(table_name) else {
            return;
        };

        // used for the cursor position
        let mut y = table.bounds.min.y;

        // Check for row range selection w/shift key
        let last = self.ranges.last().cloned();
        if shift_key {
            if let Some(CellRefRange::Table { range: table_ref }) = last {
                if let Some(col) = &col
                    && table_ref.table_name == table_name {
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
                                    col_range: ColRange::ColRange(start.clone(), col.clone()),
                                };
                                self.ranges.push(CellRefRange::Table { range: table_ref });
                                return;
                            }
                            ColRange::Col(existing_col) => {
                                // if we have a single col selected, then we
                                // create a range from that column to the new
                                // col
                                let headers = if col == existing_col {
                                    !table_ref.headers
                                } else {
                                    false
                                };
                                self.ranges.pop();

                                // if the col is already selected, then we don't need to do anything
                                let table_ref = TableRef {
                                    table_name: table_name.to_string(),
                                    data: true,
                                    headers: if existing_col == col {
                                        !table_ref.headers
                                    } else {
                                        headers
                                    },
                                    totals: false,
                                    col_range: if existing_col == col {
                                        ColRange::Col(existing_col.clone())
                                    } else {
                                        ColRange::ColRange(existing_col.clone(), col.clone())
                                    },
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
            } else if let Some(CellRefRange::Sheet { range }) = last {
                // if the range is current a sheet, then select to the heading
                if let Some(col) = &col {
                    let Some(col_index) = table.try_col_index(col) else {
                        return;
                    };
                    self.ranges.pop();
                    self.ranges.push(CellRefRange::Sheet {
                        range: RefRangeBounds {
                            start: range.start,
                            end: CellRefRangeEnd::new_relative_xy(
                                col_index + table.bounds.min.x,
                                table.bounds.min.y,
                            ),
                        },
                    });
                } else {
                    // if no column is selected, then add the entire table to the selection
                    self.ranges.push(CellRefRange::Table {
                        range: TableRef::new(table_name),
                    });
                }
                return;
            }
        }

        let (col_range, x) = if let Some(col) = col {
            if let Some(col_index) = table.try_col_index(&col) {
                if table.show_name {
                    y += 1;
                }
                (
                    ColRange::Col(table.visible_columns[col_index as usize].clone()),
                    col_index + table.bounds.min.x,
                )
            } else {
                return;
            }
        } else {
            (
                ColRange::All,
                screen_col_left
                    .max(table.bounds.min.x)
                    .min(table.bounds.max.x),
            )
        };

        let mut headers = false;
        let mut data = true;
        if !shift_key && !ctrl_key && self.ranges.len() == 1
            && let Some(CellRefRange::Table { range }) = self.ranges.last()
                && range.table_name == table_name && range.col_range == col_range {
                    // handle toggle for single column selection
                    if matches!(col_range, ColRange::Col(_)) {
                        if !range.headers && range.data {
                            headers = table.show_columns;
                            data = false;
                        } else {
                            headers = false;
                            data = true;
                        }
                        self.ranges.pop();
                    } else if matches!(col_range, ColRange::All) {
                        // handle toggle for column selection
                        headers = table.show_columns && !range.headers;
                        self.ranges.pop();
                    }
                };

        if !shift_key && !ctrl_key {
            self.ranges.clear();
        }

        let table_ref = TableRef {
            table_name: table_name.to_string(),
            data,
            headers,
            totals: false,
            col_range,
        };
        let table_ref = CellRefRange::Table { range: table_ref };

        // toggle selection with ctrl/meta key
        if ctrl_key
            && let Some(last) = self.ranges.last()
                && last == &table_ref {
                    self.ranges.pop();
                    if self.ranges.is_empty() {
                        self.ranges
                            .push(CellRefRange::new_relative_pos(self.cursor));
                    }
                    self.update_cursor(a1_context);
                    return;
                }

        self.ranges.push(table_ref);
        self.cursor = Pos { x, y };
        self.sheet_id = table.sheet_id;
    }
}

#[cfg(test)]
mod tests {
    use crate::{Rect, a1::RefRangeBounds};

    use super::*;

    #[test]
    fn test_select_table() {
        let mut context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let table = context.table_mut("Table1").unwrap();
        table.show_name = false;
        table.show_columns = false;
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
        let mut context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let table = context.table_mut("Table1").unwrap();
        table.show_name = false;
        table.show_columns = false;
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
            col_range: ColRange::Col("Col1".to_string()),
        };
        assert_eq!(
            selection.ranges[0],
            CellRefRange::Table { range: table_ref }
        );
        assert_eq!(selection.cursor, pos!(A1));
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "Table1[Col1]"
        );
    }

    #[test]
    fn test_select_table_append() {
        let mut context = A1Context::test(&[], &[("Table1", &[("Col1")], Rect::test_a1("A1"))]);
        let table = context.table_mut("Table1").unwrap();
        table.show_name = false;
        table.show_columns = false;
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
            selection.to_string(Some(SheetId::TEST), &context),
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
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "Table1[Col1]"
        );

        assert_eq!(selection.cursor, pos!(A2));
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, &context, 1, true, false);
        assert_eq!(selection.ranges.len(), 2);
        let table_ref = TableRef {
            table_name: "Table1".to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::All,
        };
        assert_eq!(selection.ranges.len(), 2);
        assert_eq!(
            selection.ranges[1],
            CellRefRange::Table { range: table_ref }
        );
        assert_eq!(selection.cursor, pos!(A1));
        assert_eq!(
            selection.to_string(Some(SheetId::TEST), &context),
            "A1,Table1"
        );
    }

    #[test]
    fn test_select_table_screen_row_bounds() {
        let context = A1Context::test(&[], &[("Table1", &["Col1"], Rect::test_a1("A5:D100"))]);
        let mut selection = A1Selection::test_a1("A1");
        selection.select_table("Table1", None, &context, 3, false, false);
        assert_eq!(selection.cursor, pos!(C5));

        // clear the table selection so we don't select twice and toggle headers
        selection.move_to(1, 1, false, &MergeCells::default());

        selection.select_table("Table1", None, &context, 2, false, false);
        assert_eq!(selection.cursor, pos!(B5));
        assert_eq!(selection.to_string(Some(SheetId::TEST), &context), "Table1");
    }
}
