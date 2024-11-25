use super::CellRefRange;

impl CellRefRange {
    /// Handle the removal of a column. Returns whether the range was changed.
    ///
    /// Note: this does not handle the case where the deleted column is the same
    /// as self's column(s). That has to be handled one step above this call.
    pub fn removed_column(&mut self, _column: u64) -> bool {
        todo!()
        // let mut changed = false;

        // if let Some(start_col) = self.start.col.as_mut() {
        //     if start_col.coord == column {
        //         if let Some(end_col) = self.end.as_mut() {
        //             if end_col.col.is_some_and(|col| col.coord > column) {
        //                 start_col.coord = end_col.coord;
        //             } else {
        //                 start_col.coord -= 1;
        //             }
        //         } else {
        //             start_col = None;
        //         }
        //     } else if start_col.coord > column {
        //         start_col.coord -= 1;
        //     }
        // }

        // if let Some(end_col) = self.end.and_then(|end| end.col.as_mut()) {
        //     if end_col.coord == column {
        //         end_col = None;
        //     } else if end_col.coord > column {
        //         end_col.coord -= 1;
        //     }
        // }

        // // unpack the end_col if it exists
        // let end_col = self
        //     .end
        //     .as_ref()
        //     .and_then(|end| end.col.as_ref().map(|col| col.coord));

        // let mut new_end_col: Option<u64> = None;

        // // Check if the start column needs to be adjusted
        // if let Some(start_col) = self.start.col.as_mut() {
        //     // handle the case where the column being removed is the same as the start column
        //     if start_col.coord == column {
        //         if let Some(end_col) = end_col {
        //             if start_col.coord == end_col {
        //                 start_col.col = None;
        //                 start_col.row = None;
        //                 new_end_col = None;
        //             }
        //         } else {
        //             // this should not happen since it's handled a level above
        //             // (see note above)
        //         }
        //     } else if start_col.coord > column {
        //         start_col.coord -= 1;
        //         if let Some(end_col) = end_col {
        //             new_end_col = Some(end_col - 1);
        //         }
        //     } else {
        //         if let Some(end_col) = end_col {
        //             if end_col > column {
        //                 new_end_col = Some(end_col - 1);
        //             }
        //         }
        //     }
        // }

        // if let Some(new_end_col) = new_end_col {
        //     self.end.as_mut().map(|end| end.col = Some(CellRefCoord { coord: new_end_col }));
        // } else {
        //     self.end = None;
        // }

        // // clean up end if it's the same as start
        // if self.end.is_some_and(|end| end == self.start) {
        //     self.end = None;
        // } else if self.start.col == None {
        //     if let Some(end_col) = self.end
        // }

        // changed
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
            match start_row.coord.cmp(&row) {
                std::cmp::Ordering::Equal => {
                    if let Some(end) = self.end.as_mut() {
                        if end.row.is_some_and(|r| r.coord == row) {
                            self.end = None;
                        } else {
                            start_row.coord -= 1;
                        }
                    } else {
                        self.start.row = None;
                    }
                }
                std::cmp::Ordering::Greater => {
                    // this should not happen
                    if start_row.coord <= 1 {
                        self.start.row = None;
                    } else {
                        start_row.coord -= 1;
                    }
                    changed = true;
                }
                std::cmp::Ordering::Less => {}
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
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test("A1:A2"));

        range = CellRefRange::test("D2:E5");
        assert!(range.removed_column(1));
        assert_eq!(range, CellRefRange::test("C2:D5"));
    }
}
