use crate::Pos;

use super::{A1Selection, CellRefRange, CellRefRangeEnd};

impl A1Selection {
    /// Selects the entire sheet.
    pub fn select_all(&mut self) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::ALL);
    }

    fn add_or_remove_column(&mut self, col: u64) {
        if let Some(range) = self.ranges.iter_mut().find(|r| r.has_column(col)) {
            // range.remove_column(col);
        }
    }

    /// Selects a single column. If append is true, then the column is appended
    /// to the ranges (or, if the last selection was a column, then the end of
    /// that column is extended).
    pub fn select_column(
        &mut self,
        col: u32,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
    ) {
        if !ctrl_key && !shift_key {
            self.ranges.clear();
            self.ranges
                .push(CellRefRange::new_relative_column(col as u64));
        } else if ctrl_key && !shift_key {
            self.add_or_remove_column(col as u64);
        }

        //  else if let Some(last_range) = self.ranges.last_mut() {
        //     if last_range.is_column_range() {
        //         last_range.end = Some(CellRefRangeEnd::new_relative_column(col as u64));
        //     } else {
        //         self.ranges
        //             .push(CellRefRange::new_relative_column(col as u64));
        //     }
        // } else {
        //     self.ranges
        //         .push(CellRefRange::new_relative_column(col as u64));
        // }
    }

    /// Selects a single row. If append is true, then the row is appended
    /// to the ranges (or, if the last selection was a row, then the end of
    /// that row is extended).
    pub fn select_row(&mut self, row: u32, ctrl_key: bool, shift_key: bool, is_right_click: bool) {
        if !ctrl_key && !shift_key {
            self.ranges.clear();
            self.ranges.push(CellRefRange::new_relative_row(row as u64));
        } else if let Some(last_range) = self.ranges.last_mut() {
            if last_range.is_row_range() {
                last_range.end = Some(CellRefRangeEnd::new_relative_row(row as u64));
            } else {
                self.ranges.push(CellRefRange::new_relative_row(row as u64));
            }
        } else {
            self.ranges.push(CellRefRange::new_relative_row(row as u64));
        }
    }

    /// Selects a rectangular range. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of
    /// that range is extended).
    pub fn select_rect(&mut self, left: u64, top: u64, right: u64, bottom: u64, append: bool) {
        if !append {
            self.ranges.clear();
        }
        if left == right && top == bottom {
            self.ranges.push(CellRefRange::new_relative_xy(left, top));
        } else {
            self.ranges.push(CellRefRange {
                start: CellRefRangeEnd::new_relative_xy(left, top),
                end: Some(CellRefRangeEnd::new_relative_xy(right, bottom)),
            });
        }
        self.cursor.x = right as i64;
        self.cursor.y = bottom as i64;
    }

    /// Selects a rectangular range from the cursor to the given position. If append is true, then the
    /// range is appended to the ranges (or, if the last selection was a range, then the end of that
    /// range is extended).
    pub fn select_to(&mut self, x: u64, y: u64, append: bool) {
        if append {
            if let Some(last_range) = self.ranges.last_mut() {
                last_range.end = Some(CellRefRangeEnd::new_relative_xy(x, y));
            } else {
                self.ranges.push(CellRefRange {
                    start: CellRefRangeEnd::new_relative_xy(
                        self.cursor.x as u64,
                        self.cursor.y as u64,
                    ),
                    end: Some(CellRefRangeEnd::new_relative_xy(x, y)),
                });
            }
        } else {
            self.ranges.clear();
            self.ranges.push(CellRefRange {
                start: CellRefRangeEnd::new_relative_xy(self.cursor.x as u64, self.cursor.y as u64),
                end: Some(CellRefRangeEnd::new_relative_xy(x, y)),
            });
        }
    }

    /// Changes the size of the last selection by the given delta.
    pub fn delta_size(&mut self, delta_x: i64, delta_y: i64) {
        if let Some(last_range) = self.ranges.last_mut() {
            if let Some(end) = last_range.end {
                last_range.end = Some(end.delta_size(delta_x, delta_y));
            } else {
                last_range.end = Some(CellRefRangeEnd {
                    col: last_range.start.col.map(|c| c.clone().delta_size(delta_x)),
                    row: last_range.start.row.map(|r| r.clone().delta_size(delta_y)),
                });
            }
        } else {
            self.ranges.push(CellRefRange {
                start: CellRefRangeEnd::new_relative_xy(self.cursor.x as u64, self.cursor.y as u64),
                end: Some(CellRefRangeEnd::new_relative_xy(
                    (self.cursor.x as i64 + delta_x) as u64,
                    (self.cursor.y as i64 + delta_y) as u64,
                )),
            });
        }
    }

    /// Moves the cursor to the given position and clears the selection.
    pub fn move_to(&mut self, x: i64, y: i64) {
        self.cursor.x = x as i64;
        self.cursor.y = y as i64;
        self.ranges.clear();
        self.ranges
            .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
    }

    /// Changes the selection to select all columns that have a selection (used by cmd+space). It only
    /// checks the last range (the same as Excel and Sheets)
    pub fn set_columns_selected(&mut self) {
        let start: u64;
        let mut end: Option<u64> = None;
        if let Some(last) = self.ranges.last_mut() {
            if let Some(end_col) = last.end.as_ref().and_then(|end| end.col) {
                if let Some(start_col) = last.start.col {
                    start = start_col.coord;
                    end = Some(end_col.coord);
                } else {
                    start = end_col.coord;
                }
            } else if let Some(col) = last.start.col {
                start = col.coord;
            } else {
                start = self.cursor.x as u64;
            }
        } else {
            start = self.cursor.x as u64;
        }
        self.ranges.clear();
        self.ranges.push(CellRefRange {
            start: CellRefRangeEnd::new_relative_column(start),
            end: end.map(|end| CellRefRangeEnd::new_relative_column(end)),
        });
    }

    /// Changes the selection to select all rows that have a selection (used by shift+space). It only
    /// checks the last range (the same as Excel and Sheets)
    pub fn set_rows_selected(&mut self) {
        let start: u64;
        let mut end: Option<u64> = None;
        if let Some(last) = self.ranges.last() {
            if let Some(end_row) = last.end.as_ref().and_then(|end| end.row) {
                if let Some(start_row) = last.start.row {
                    start = start_row.coord;
                    end = Some(end_row.coord);
                } else {
                    start = end_row.coord;
                }
            } else if let Some(row) = last.start.row {
                start = row.coord;
            } else {
                start = self.cursor.y as u64;
            }
        } else {
            start = self.cursor.y as u64;
        }
        self.ranges.clear();
        self.ranges.push(CellRefRange {
            start: CellRefRangeEnd::new_relative_row(start),
            end: end.map(|end| CellRefRangeEnd::new_relative_row(end)),
        });
    }

    /// Extends the last selection to the given position. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub fn extend_selection(&mut self, column: u64, row: u64, append: bool) {
        // if the selection is empty, then we use the cursor as the starting point
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        };
        if let Some(last) = self.ranges.last_mut() {
            last.end = Some(CellRefRangeEnd::new_relative_xy(column, row));
        }
        if !append {
            self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_select_all() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.select_all();
        assert_eq!(selection.test_string(), "*");
    }

    #[test]
    fn test_select_column() {
        todo!();
    }

    #[test]
    fn test_delta_size() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.delta_size(1, 1);
        assert_eq!(selection.test_string(), "A1,B1,C1:D2");

        selection = A1Selection::test("D2:E2");
        selection.delta_size(1, 0);
        assert_eq!(selection.test_string(), "D2:F2");

        selection = A1Selection::test("D:E");
        selection.delta_size(1, 0);
        assert_eq!(selection.test_string(), "D:F");

        selection = A1Selection::test("D:E");
        selection.delta_size(0, 1);
        assert_eq!(selection.test_string(), "D:E");

        selection = A1Selection::test("A1,3");
        selection.delta_size(0, 1);
        assert_eq!(selection.test_string(), "A1,3:4");

        selection = A1Selection::test("A1:B2");
        selection.delta_size(-1, -1);
        assert_eq!(selection.test_string(), "A1");

        selection = A1Selection::test("2:4");
        selection.delta_size(0, 2);
        assert_eq!(selection.test_string(), "2:6");

        selection = A1Selection::test("A:C");
        selection.delta_size(-1, 0);
        assert_eq!(selection.test_string(), "A:B");

        selection = A1Selection::test("A1,B2,C3");
        selection.delta_size(1, 1);
        assert_eq!(selection.test_string(), "A1,B2,C3:D4");
    }

    #[test]
    fn test_delta_negative_range() {
        let mut selection = A1Selection::test("B2");
        selection.delta_size(-2, -2);
        assert_eq!(selection.test_string(), "B2:A1");

        selection = A1Selection::test("A1");
        selection.delta_size(-1, -1);
        assert_eq!(selection.test_string(), "A1");

        selection = A1Selection::test("E5:G6");
        selection.delta_size(-3, -3);
        assert_eq!(selection.test_string(), "E5:D3");
    }

    #[test]
    fn test_delta_size_zero() {
        let mut selection = A1Selection::test("A1");
        selection.delta_size(0, 0);
        assert_eq!(selection.test_string(), "A1");
    }

    #[test]
    fn test_move_to() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.move_to(2, 2);
        assert_eq!(selection.test_string(), "B2");
    }

    #[test]
    fn test_columns_selected() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.set_columns_selected();
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_column(3)]);

        let mut selection = A1Selection::test("A1:C1");
        selection.set_columns_selected();
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_column_range(1, 3)]
        );

        let mut selection = A1Selection::test("A:C");
        selection.set_columns_selected();
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_column_range(1, 3)]
        );

        let mut selection = A1Selection::test("2:3");
        selection.set_columns_selected();
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_column(1)]);
    }

    #[test]
    fn test_rows_selected() {
        let mut selection = A1Selection::test("A1,B2,C3");
        selection.set_rows_selected();
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_row(3)]);

        let mut selection = A1Selection::test("A1:C3");
        selection.set_rows_selected();
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_row_range(1, 3)]
        );

        let mut selection = A1Selection::test("1:3");
        selection.set_rows_selected();
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_row_range(1, 3)]
        );

        let mut selection = A1Selection::test("C:D");
        selection.set_rows_selected();
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_row(1)]);
    }

    #[test]
    fn test_select_row() {
        let mut selection = A1Selection::test("A1,B2,C3");
        selection.select_row(2, false, false, false);
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_row(2)]);
    }

    #[test]
    fn test_select_rect() {
        let mut selection = A1Selection::test("A1,B2,C3");
        selection.select_rect(1, 1, 2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:B2")]);

        selection = A1Selection::test("A1:C3");
        selection.select_rect(3, 3, 5, 5, true);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A1:C3"), CellRefRange::test("C3:E5"),]
        );
    }

    #[test]
    fn test_extend_selection() {
        let mut selection = A1Selection::test("A1");
        selection.extend_selection(2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:B2")]);

        selection = A1Selection::test("A:B");
        selection.extend_selection(2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A:B2")]);
    }

    #[test]
    fn test_select_to() {
        let mut selection = A1Selection::test("A1,B2,C3");
        selection.select_to(2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("C3:B2")]);
    }
}
