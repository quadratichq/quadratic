use crate::{Pos, Rect};

use super::{A1Selection, CellRefCoord, CellRefRange, CellRefRangeEnd};

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
            self.ranges.push(CellRefRange::new_relative_rect(Rect::new(
                self.cursor.x,
                self.cursor.y,
                self.cursor.x + delta_x,
                self.cursor.y + delta_y,
            )));
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

    pub fn is_multi_cursor(&self) -> bool {
        if self.ranges.len() > 1 {
            return true;
        }
        if let Some(last_range) = self.ranges.last() {
            if let Some(end) = last_range.end {
                return last_range.start != end && !last_range.start.is_multi_range();
            }
        }
        false
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

    #[test]
    fn test_delta_size() {
        let mut selection =
            A1Selection::from_str("A1,B1,C1", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(1, 1);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1,B1,C1:D2"
        );

        selection = A1Selection::from_str("D2:E2", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(1, 0);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "D2:F2"
        );

        selection = A1Selection::from_str("D:E", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(1, 0);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "D:F"
        );

        selection = A1Selection::from_str("D:E", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(0, 1);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "D:E"
        );

        selection = A1Selection::from_str("A1,3", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(0, 1);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1,3:4"
        );

        selection = A1Selection::from_str("A1:B2", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(-1, -1);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1:A1"
        );

        selection = A1Selection::from_str("2:4", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(0, 2);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "2:6"
        );

        selection = A1Selection::from_str("A:C", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(-1, 0);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A:B"
        );

        selection = A1Selection::from_str("A1,B2,C3", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(1, 1);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1,B2,C3:D4"
        );
    }

    #[test]
    fn test_delta_negative_range() {
        let mut selection = A1Selection::from_str("B2", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(-2, -2);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "B2:A1"
        );

        selection = A1Selection::from_str("A1", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(-1, -1);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1"
        );
    }

    #[test]
    fn test_delta_size_zero() {
        let mut selection = A1Selection::from_str("A1", SheetId::test(), &HashMap::new()).unwrap();
        selection.delta_size(0, 0);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "A1"
        );
    }

    #[test]
    fn test_move_to() {
        let mut selection =
            A1Selection::from_str("A1,B1,C1", SheetId::test(), &HashMap::new()).unwrap();
        selection.move_to(2, 2);
        assert_eq!(
            selection.to_string(Some(SheetId::test()), &HashMap::new()),
            "B2"
        );
    }
}
