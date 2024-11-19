use super::CellRefRange;

impl CellRefRange {
    /// Handle the removal of a column. Returns whether the range was changed.
    ///
    /// Note: this does not handle the case where the deleted column is the same
    /// as self's column(s). That has to be handled one step above this call.
    pub fn removed_column(&mut self, column: u64) -> bool {
        let mut changed = false;

        // Check if the start column needs to be adjusted
        if let Some(start_col) = self.start.col.as_mut() {
            // handle the case where the column being removed is the same as the start column
            if start_col.coord == column {
                // todo: make this work properly...
                if let Some(end) = self.end.as_mut() {
                    if end.col.is_some_and(|col| col.coord == column) {
                        self.end = None;
                    } else {
                        start_col.coord -= 1;
                    }
                } else {
                    self.start.col = None;
                }
            } else if start_col.coord > column {
                // this should not happen
                if start_col.coord <= 1 {
                    self.start.col = None;
                } else {
                    start_col.coord -= 1;
                }
                changed = true;
            }
        }

        // Check if the end column needs to be adjusted
        if let Some(end) = self.end.as_mut() {
            if let Some(end_col) = end.col.as_mut() {
                if end_col.coord >= column {
                    if end_col.coord <= 1 {
                        end.col = None;
                    } else {
                        end_col.coord -= 1;
                    }
                    changed = true;
                }
            }
        }
        // clean up end if it's the same as start
        if self.end.is_some_and(|end| end == self.start) {
            self.end = None;
        }

        changed
    }

    /// Handle the removal of a row. Returns whether the range was changed.
    ///
    /// Note: this does not handle the case where the deleted row is the same as
    /// self's row(s). That has to be handled one step above this call.
    pub fn removed_row(&mut self, row: u64) -> bool {
        let mut changed = false;

        // Check if the start row needs to be adjusted
        if let Some(start_row) = self.start.row.as_mut() {
            // handle the case where the row being removed is the same as the start row
            if start_row.coord == row {
                if let Some(end) = self.end.as_mut() {
                    if end.row.is_some_and(|r| r.coord == row) {
                        self.end = None;
                    } else {
                        start_row.coord -= 1;
                    }
                } else {
                    self.start.row = None;
                }
            } else if start_row.coord > row {
                // this should not happen
                if start_row.coord <= 1 {
                    self.start.row = None;
                } else {
                    start_row.coord -= 1;
                }
                changed = true;
            }
        }

        // Check if the end row needs to be adjusted
        if let Some(end) = self.end.as_mut() {
            if let Some(end_row) = end.row.as_mut() {
                if end_row.coord >= row {
                    if end_row.coord <= 1 {
                        end.row = None;
                    } else {
                        end_row.coord -= 1;
                    }
                    changed = true;
                }
            }
        }
        // clean up end if it's the same as start
        if self.end.is_some_and(|end| end == self.start) {
            self.end = None;
        }

        changed
    }

    pub fn inserted_column(&mut self, _column: u64) -> bool {
        false
    }

    pub fn inserted_row(&mut self, _row: u64) -> bool {
        false
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_removed_column() {
        let mut range = CellRefRange::test("A1:B2");
        assert_eq!(range.removed_column(1), true);
        assert_eq!(range, CellRefRange::test("A1:A2"));

        range = CellRefRange::test("D2:E5");
        assert_eq!(range.removed_column(1), true);
        assert_eq!(range, CellRefRange::test("C2:D5"));
    }
}
