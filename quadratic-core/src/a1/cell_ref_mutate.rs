use super::CellRefRange;

impl CellRefRange {
    /// Handle the removal of a column.
    ///
    /// Returns whether the range was changed.
    pub fn removed_column(&mut self, column: u64) -> bool {
        let mut changed = false;

        // Check if the start column needs to be adjusted
        if let Some(start_col) = self.start.col.as_mut() {
            if start_col.coord >= column {
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

    pub fn removed_row(&mut self, row: u64) -> bool {
        unimplemented!()
    }

    pub fn inserted_column(&mut self, column: u64) -> bool {
        unimplemented!()
    }

    pub fn inserted_row(&mut self, row: u64) -> bool {
        unimplemented!()
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
