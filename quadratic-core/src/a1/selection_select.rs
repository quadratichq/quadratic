use crate::Pos;

use super::{A1Selection, CellRefRange, CellRefRangeEnd};

impl A1Selection {
    /// Selects the entire sheet.
    pub fn select_all(&mut self) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::ALL);
    }

    /// Removes a column if it is in any column ranges, or adds it if it is not.
    fn add_or_remove_column(&mut self, col: u64, top: i64) {
        // Find the index of the first range that contains this column
        let i = self.ranges.iter().position(|range| range.has_column(col));

        if let Some(i) = i {
            // Remove just that one range
            let mut range = self.ranges.remove(i);
            let start_col = range.start.col.map(|col| col.coord);
            let end_col = range.end.and_then(|end| end.col.map(|col| col.coord));

            if let (Some(start_col), Some(end_col)) = (start_col, end_col) {
                // If the range is a single column, then nothing more to do
                if start_col == end_col {
                    return;
                }
                // handle case where start_col is deleted
                else if start_col == col {
                    // if end_col is the column right after the one being
                    // deleted, then we no longer have a range
                    if end_col == col - 1 {
                        range.start = CellRefRangeEnd::new_relative_column(col + 1);
                        range.end = None;
                        self.ranges.push(range);
                    }
                    // otherwise we move the start to the next column
                    else {
                        range.start = CellRefRangeEnd::new_relative_column(col + 1);
                        self.ranges.push(range);
                    }
                }
                // handle case where end_col is deleted
                else if end_col == col {
                    // if start_col is the column right before the one being deleted, then we no
                    // longer have a range
                    if start_col == col - 1 {
                        range.end = None;
                        self.ranges.push(range);
                    }
                    // otherwise we move the end to the previous column
                    else {
                        range.end = Some(CellRefRangeEnd::new_relative_column(col - 1));
                        self.ranges.push(range);
                    }
                } else {
                    let first = CellRefRange::new_relative_column_range(start_col, col - 1);
                    let second = CellRefRange::new_relative_column_range(col + 1, end_col);
                    self.ranges.push(first);
                    self.ranges.push(second);
                }
            }

            // if we deleted the last range, then we use the cursor + top as the
            // new range
            if self.ranges.is_empty() {
                self.ranges.push(CellRefRange::new_relative_xy(
                    self.cursor.x as u64,
                    top as u64,
                ));
                self.cursor.y = top;
            }
        } else {
            // Add the column if it wasn't found and set the cursor position
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col as i64;
            self.cursor.y = top;
        }
    }

    /// Extends the last column range or creates a new one.
    pub fn extend_column(&mut self, col: u64, top: i64) {
        if let Some(last) = self.ranges.last_mut() {
            if last.is_column_range() {
                last.end = Some(CellRefRangeEnd::new_relative_column(col));
            } else {
                last.end = Some(CellRefRangeEnd::new_relative_column(col));
                self.cursor.y = last.start.row.map_or(top, |r| r.coord as i64);
            }
        } else {
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col as i64;
            self.cursor.y = top;
        }
    }

    /// Removes a row if it is in any row ranges, or adds it if it is not.
    fn add_or_remove_row(&mut self, row: u64, left: u64) {
        // Find the index of the first range that contains this row
        let i = self.ranges.iter().position(|range| range.has_row(row));

        if let Some(i) = i {
            // Remove just that one range
            let mut range = self.ranges.remove(i);
            let start_row = range.start.row.map(|row| row.coord);
            let end_row = range.end.and_then(|end| end.row.map(|row| row.coord));

            if let (Some(start_row), Some(end_row)) = (start_row, end_row) {
                // If the range is a single row, then nothing more to do
                if start_row == end_row {
                    return;
                }
                // handle case where start_row is deleted
                else if start_row == row {
                    // if end_row is the row right after the one being
                    // deleted, then we no longer have a range
                    if end_row == row - 1 {
                        range.start = CellRefRangeEnd::new_relative_row(row + 1);
                        range.end = None;
                        self.ranges.push(range);
                    }
                    // otherwise we move the start to the next column
                    else {
                        range.start = CellRefRangeEnd::new_relative_row(row + 1);
                        self.ranges.push(range);
                    }
                }
                // handle case where end_row is deleted
                else if end_row == row {
                    // if start_row is the row right before the one being deleted, then we no
                    // longer have a range
                    if start_row == row - 1 {
                        range.end = None;
                        self.ranges.push(range);
                    }
                    // otherwise we move the end to the previous row
                    else {
                        range.end = Some(CellRefRangeEnd::new_relative_row(row - 1));
                        self.ranges.push(range);
                    }
                } else {
                    let first = CellRefRange::new_relative_row_range(start_row, row - 1);
                    let second = CellRefRange::new_relative_row_range(row + 1, end_row);
                    self.ranges.push(first);
                    self.ranges.push(second);
                }
            }

            // if we deleted the last range, then we use the cursor + top as the
            // new range
            if self.ranges.is_empty() {
                self.ranges.push(CellRefRange::new_relative_xy(
                    left,
                    self.cursor.y as u64,
                ));
                self.cursor.x = left as i64;
            }
        } else {
            // Add the row if it wasn't found and set the cursor position
            self.ranges.push(CellRefRange::new_relative_row(row));
            self.cursor.x = left as i64;
            self.cursor.y = row as i64;
        }
    }

    /// Selects a single column based on keyboard modifiers.
    pub fn select_column(
        &mut self,
        col: u64,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,

        // top of the screen to change the cursor position when selecting a column
        top: i64,
    ) {
        if is_right_click || (!ctrl_key && !shift_key) {
            self.ranges.clear();
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col as i64;
            self.cursor.y = top;
        } else if ctrl_key && !shift_key {
            self.add_or_remove_column(col, top);
        } else if shift_key {
            self.extend_column(col, top);
        }
    }

    /// Extends the last row range or creates a new one.
    pub fn extend_row(&mut self, row: u64, left: u64) {
        if let Some(last) = self.ranges.last_mut() {
            if last.is_row_range() {
                last.end = Some(CellRefRangeEnd::new_relative_row(row));
            } else {
                last.end = Some(CellRefRangeEnd::new_relative_row(row));
                self.cursor.x = last.start.col.map_or(left as i64, |c| c.coord as i64);
            }
        } else {
            self.ranges.push(CellRefRange::new_relative_row(row));
            self.cursor.x = left as i64;
            self.cursor.y = row as i64;
        }
    }

    /// Selects a single row. If append is true, then the row is appended
    /// to the ranges (or, if the last selection was a row, then the end of
    /// that row is extended).
    pub fn select_row(
        &mut self,
        row: u32,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,

        // left of the screen to change the cursor position when selecting a row
        left: u64,
    ) {
        if is_right_click || (!ctrl_key && !shift_key) {
            self.ranges.clear();
            self.ranges.push(CellRefRange::new_relative_row(row as u64));
            self.cursor.x = left as i64;
            self.cursor.y = row as i64;
        } else if ctrl_key && !shift_key {
            self.add_or_remove_row(row as u64, left);
        } else if shift_key {
            self.extend_row(row as u64, left);
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

    /// Moves the cursor to the given position and clears the selection.
    pub fn move_to(&mut self, x: i64, y: i64, append: bool) {
        self.cursor.x = x;
        self.cursor.y = y;
        if !append {
            self.ranges.clear();
        }
        self.ranges
            .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
    }

    /// Extends the last selection to the given position. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub(crate) fn select_to(&mut self, column: u64, row: u64, append: bool) {
        // if the selection is empty, then we use the cursor as the starting point
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        };
        if let Some(last) = self.ranges.last_mut() {
            last.end = Some(CellRefRangeEnd::new_relative_xy(column, row));
            if last.start.row.is_none() {
                self.cursor.y = row as i64;
            }
            if last.start.col.is_none() {
                self.cursor.x = column as i64;
            }
            // we don't need an end if it's the same as the start
            if last.start.col.is_some_and(|start| start.coord == column)
                && last.start.row.is_some_and(|start| start.coord == row)
            {
                last.end = None;
            }
        }
        if !append {
            self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
        }
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
            end: end.map(CellRefRangeEnd::new_relative_column),
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
            end: end.map(CellRefRangeEnd::new_relative_row),
        });
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
        let mut selection = A1Selection::test("A1");
        selection.select_column(2, false, false, false, 1);
        assert_eq!(selection.test_string(), "B");
    }

    #[test]
    fn test_move_to() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.move_to(2, 2, false);
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
        let mut selection = A1Selection::test("A1");
        selection.select_row(2, false, false, false, 1);
        assert_eq!(selection.test_string(), "2");
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
    fn test_select_to() {
        let mut selection = A1Selection::test("A1");
        selection.select_to(2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:B2")]);

        selection = A1Selection::test("A:B");
        selection.select_to(2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A:B2")]);

        selection = A1Selection::test("A1");
        selection.select_to(3, 3, false);
        selection.select_to(1, 1, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1")]);

        let mut selection = A1Selection::test("A1,B2,C3");
        selection.select_to(2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("C3:B2")]);
    }

    #[test]
    fn test_add_or_remove_column() {
        let mut selection = A1Selection::test("A1,B1,C1");
        selection.add_or_remove_column(4, 2);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("A1"),
                CellRefRange::test("B1"),
                CellRefRange::test("C1"),
                CellRefRange::test("D")
            ]
        );
        assert_eq!(selection.cursor.x, 4);
        assert_eq!(selection.cursor.y, 2);

        let mut selection = A1Selection::test("A:D,B1,A");
        selection.add_or_remove_column(1, 2);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("B1"),
                CellRefRange::test("A"),
                CellRefRange::test("B:D"),
            ]
        );
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 1);

        let mut selection = A1Selection::test("A");
        selection.add_or_remove_column(1, 2);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A2")]);
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 2);
    }

    #[test]
    fn test_extend_column() {
        let mut selection = A1Selection::test("A1,B");
        selection.extend_column(4, 2);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A1"), CellRefRange::test("B:D")]
        );
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 1);
    }

    #[test]
    fn test_add_or_remove_row() {
        let mut selection = A1Selection::test("A1,B2,3");
        selection.add_or_remove_row(4, 2);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("A1"),
                CellRefRange::test("B2"),
                CellRefRange::test("3"),
                CellRefRange::test("4")
            ]
        );
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 4);

        // Test removing a row from a range
        let mut selection = A1Selection::test("1:4");
        selection.add_or_remove_row(2, 1);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("1"), CellRefRange::test("3:4")]
        );

        // Test removing the only selected row
        let mut selection = A1Selection::test("3");
        selection.add_or_remove_row(3, 1);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A3")]);
    }

    #[test]
    fn test_extend_row() {
        let mut selection = A1Selection::test("A2,1");
        selection.extend_row(4, 2);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A2"), CellRefRange::test("1:4")]
        );
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 1);

        // Test extending an empty selection
        let mut selection = A1Selection::test("A1");
        selection.extend_row(3, 1);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:3")]);
    }

    #[test]
    fn test_select_rect_single_cell() {
        let mut selection = A1Selection::test("A1");
        selection.select_rect(2, 2, 2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test("B2")]);
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 2);
    }

    #[test]
    fn test_select_to_with_append() {
        let mut selection = A1Selection::test("A1");
        selection.select_to(2, 2, true);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:B2")]);

        // Test appending to existing selection
        selection.select_to(3, 3, true);
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1:C3")]);
    }
}
