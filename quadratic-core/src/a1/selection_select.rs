use super::{A1Selection, CellRefRange, CellRefRangeEnd};

impl A1Selection {
    /// Selects the entire sheet.
    pub fn select_all(&mut self) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::ALL);
    }

    /// Selects a single column. If append is true, then the column is appended
    /// to the ranges (or, if the last selection was a column, then the end of
    /// that column is extended).
    pub fn select_column(&mut self, col: u32, append: bool) {
        if !append {
            self.ranges.clear();
            self.ranges
                .push(CellRefRange::new_relative_column(col as u64));
        } else if let Some(last_range) = self.ranges.last_mut() {
            if last_range.is_column_range() {
                last_range.end = Some(CellRefRangeEnd::new_relative_column(col as u64));
            } else {
                self.ranges
                    .push(CellRefRange::new_relative_column(col as u64));
            }
        } else {
            self.ranges
                .push(CellRefRange::new_relative_column(col as u64));
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use std::collections::HashMap;

    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn test_select_all() {
        let mut selection =
            A1Selection::from_str("A1,B1,C1", SheetId::test(), &HashMap::new()).unwrap();
        selection.select_all();
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "*"
        );
    }

    #[test]
    fn test_select_column() {
        let mut selection =
            A1Selection::from_str("A1,B1,C1", SheetId::test(), &HashMap::new()).unwrap();
        selection.select_column(2, false);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "B"
        );
    }
}
