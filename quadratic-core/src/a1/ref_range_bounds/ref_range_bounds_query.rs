use super::*;

impl RefRangeBounds {
    /// Returns whether the range is **valid**.
    ///
    /// A range is valid if it can be represented using a nonempty string.
    pub fn is_valid(self) -> bool {
        self.start.col.is_some() || self.start.row.is_some() || self.end.is_some()
    }

    /// Returns whether `self` is a single column or a column range.
    pub fn is_column_range(&self) -> bool {
        self.start.row.is_none() && self.end.map_or(true, |end| end.row.is_none())
    }

    /// Returns whether `self` is a multi-cursor.
    pub fn is_multi_cursor(&self) -> bool {
        if self.start.is_multi_range() {
            return true;
        }
        if let Some(end) = self.end {
            return self.start != end;
        }
        false
    }

    /// Returns whether `self` is the entire range.
    pub fn is_all(&self) -> bool {
        self == &Self::ALL
    }

    /// Returns whether `self` contains the column `col` in its column range.
    pub fn has_column_range(&self, col: i64) -> bool {
        if !self.is_column_range() {
            return false;
        }
        let min = self.start.col.map_or(1, |c| c.coord);

        if let Some(end) = self.end {
            let max = end.col.map_or(i64::MAX, |c| c.coord);
            col >= min && col <= max
        } else {
            col == min
        }
    }

    /// Returns whether `self` is a single row or a row range.
    pub fn is_row_range(&self) -> bool {
        self.start.col.is_none() && self.end.map_or(true, |end| end.col.is_none())
    }

    /// Returns whether `self` contains the row `row` in its row range.
    pub fn has_row_range(&self, row: i64) -> bool {
        if !self.is_row_range() {
            return false;
        }
        let min = self.start.row.map_or(1, |r| r.coord);

        if let Some(end) = self.end {
            let max = end.row.map_or(i64::MAX, |r| r.coord);
            row >= min && row <= max
        } else {
            row == min
        }
    }

    /// Returns whether `self` is a finite range.
    pub fn is_finite(&self) -> bool {
        self.start.col.is_some()
            && self.start.row.is_some()
            && self
                .end
                .is_none_or(|end| end.col.is_some() && end.row.is_some())
    }

    /// Returns true if the range is a single cell.
    pub fn is_single_cell(&self) -> bool {
        self.start.col.is_some() && self.start.row.is_some() && self.end.is_none()
    }

    /// Tries to convert the range to a single cell position. This will only
    /// return Some if the range is a single cell.
    pub fn try_to_pos(&self) -> Option<Pos> {
        if self.is_single_cell() {
            Some(Pos {
                x: self.start.col.unwrap().coord,
                y: self.start.row.unwrap().coord,
            })
        } else {
            None
        }
    }

    /// Returns a rectangle that bounds a finite range.
    pub fn to_rect(&self) -> Option<Rect> {
        if let (Some(start_col), Some(start_row)) = (self.start.col, self.start.row) {
            if let Some(end) = self.end {
                if let (Some(end_col), Some(end_row)) = (end.col, end.row) {
                    Some(Rect::new(
                        start_col.coord,
                        start_row.coord,
                        end_col.coord,
                        end_row.coord,
                    ))
                } else {
                    None
                }
            } else {
                Some(Rect::single_pos(Pos {
                    x: start_col.coord,
                    y: start_row.coord,
                }))
            }
        } else {
            None
        }
    }

    /// Returns only the finite columns in the range.
    pub fn selected_columns_finite(&self) -> Vec<i64> {
        let mut columns = vec![];
        if let Some(start_col) = self.start.col {
            if let Some(end) = self.end {
                if let Some(end_col) = end.col {
                    columns.extend(start_col.coord..=end_col.coord);
                }
            } else {
                columns.push(start_col.coord);
            }
        }
        columns
    }

    /// Returns the selected columns in the range that fall between `from` and `to`.
    pub fn selected_columns(&self, from: i64, to: i64) -> Vec<i64> {
        let mut columns = vec![];
        if let Some(start_col) = self.start.col {
            if let Some(end) = self.end {
                if let Some(end_col) = end.col {
                    columns.extend(start_col.coord.max(from)..=end_col.coord.min(to));
                } else {
                    columns.extend(start_col.coord.max(from)..=to);
                }
            } else if start_col.coord >= from && start_col.coord <= to {
                columns.push(start_col.coord);
            }
        } else if let Some(end) = self.end {
            if let Some(end_col) = end.col {
                columns.extend(end_col.coord.max(from)..=to);
            } else {
                columns.extend(from..=to);
            }
        } else {
            columns.extend(from..=to);
        }
        columns
    }

    /// Returns only the finite rows in the range.
    pub fn selected_rows_finite(&self) -> Vec<i64> {
        let mut rows = vec![];
        if let Some(start_row) = self.start.row {
            if let Some(end) = self.end {
                if let Some(end_row) = end.row {
                    rows.extend(start_row.coord..=end_row.coord);
                }
            } else {
                rows.push(start_row.coord);
            }
        }
        rows
    }

    /// Returns the selected rows in the range that fall between `from` and `to`.
    pub fn selected_rows(&self, from: i64, to: i64) -> Vec<i64> {
        let mut rows = vec![];
        if let Some(start_row) = self.start.row {
            if let Some(end) = self.end {
                if let Some(end_row) = end.row {
                    rows.extend(start_row.coord.max(from)..=end_row.coord.min(to));
                } else {
                    rows.extend(start_row.coord.max(from)..=to);
                }
            } else if start_row.coord >= from && start_row.coord <= to {
                rows.push(start_row.coord);
            }
        } else if let Some(end) = self.end {
            if let Some(end_row) = end.row {
                rows.extend(end_row.coord.max(from)..=to);
            } else {
                rows.extend(from..=to);
            }
        } else {
            rows.extend(from..=to);
        }
        rows
    }

    /// Converts the CellRefRange to coordinates to be used in Contiguous2D.
    pub fn to_contiguous2d_coords(&self) -> (i64, i64, Option<i64>, Option<i64>) {
        if let Some(end) = self.end {
            (
                self.start.col_or(1),
                self.start.row_or(1),
                end.col.map(|c| c.coord),
                end.row.map(|r| r.coord),
            )
        } else {
            if self.start.col.is_none() && self.start.row.is_none() {
                (1, 1, None, None)
            } else if self.start.col.is_none() {
                (1, self.start.row_or(1), None, Some(self.start.row_or(1)))
            } else if self.start.row.is_none() {
                (self.start.col_or(1), 1, Some(self.start.col_or(1)), None)
            } else {
                (
                    self.start.col_or(1),
                    self.start.row_or(1),
                    Some(self.start.col_or(1)),
                    Some(self.start.row_or(1)),
                )
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_is_finite() {
        assert!(RefRangeBounds::test_a1("A1").is_finite());
        assert!(!RefRangeBounds::test_a1("A").is_finite());
        assert!(!RefRangeBounds::test_a1("1").is_finite());
    }

    #[test]
    fn test_to_rect() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").to_rect(),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").to_rect(),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(RefRangeBounds::test_a1("A:B").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("1:2").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("A1:C").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("A:C3").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("*").to_rect(), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!RefRangeBounds::test_a1("A1").is_column_range());
        assert!(RefRangeBounds::test_a1("A").is_column_range());
        assert!(!RefRangeBounds::test_a1("A1:C3").is_column_range());
        assert!(RefRangeBounds::test_a1("A:C").is_column_range());
        assert!(RefRangeBounds::test_a1("A1:C").is_column_range());
        assert!(RefRangeBounds::test_a1("A:C1").is_column_range());
        assert!(RefRangeBounds::test_a1("*").is_column_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!RefRangeBounds::test_a1("A1").is_row_range());
        assert!(!RefRangeBounds::test_a1("A").is_row_range());
        assert!(!RefRangeBounds::test_a1("A1:C3").is_row_range());
        assert!(RefRangeBounds::test_a1("1").is_row_range());
        assert!(RefRangeBounds::test_a1("1:3").is_row_range());

        // technically, this is the same as 1:3, but not worth the edge case
        assert!(!RefRangeBounds::test_a1("A1:3").is_row_range());

        assert!(!RefRangeBounds::test_a1("1:C3").is_row_range());
        assert!(RefRangeBounds::test_a1("*").is_row_range());
    }

    #[test]
    fn test_has_column_range() {
        assert!(RefRangeBounds::test_a1("A").has_column_range(1));
        assert!(!RefRangeBounds::test_a1("A").has_column_range(2));
        assert!(RefRangeBounds::test_a1("A:B").has_column_range(1));
        assert!(RefRangeBounds::test_a1("A:B").has_column_range(2));
        assert!(!RefRangeBounds::test_a1("A:B").has_column_range(3));

        assert!(!RefRangeBounds::test_a1("A1").has_column_range(1));
        assert!(!RefRangeBounds::test_a1("1").has_column_range(1));

        // technically, this is the same as A:C, but not worth the edge case
        assert!(!RefRangeBounds::test_a1("A1:C").has_column_range(2));

        assert!(!RefRangeBounds::test_a1("A1:C3").has_column_range(2));

        assert!(RefRangeBounds::test_a1("A:").has_column_range(1));
        assert!(!RefRangeBounds::test_a1("D:").has_column_range(1));
        assert!(RefRangeBounds::test_a1("D:").has_column_range(col![E]));

        assert!(RefRangeBounds::test_a1("*").has_column_range(col![E]));
        assert!(!RefRangeBounds::test_a1("1:").has_column_range(col![A]));
    }

    #[test]
    fn test_has_row_range() {
        assert!(RefRangeBounds::test_a1("1").has_row_range(1));
        assert!(!RefRangeBounds::test_a1("1").has_row_range(2));
        assert!(RefRangeBounds::test_a1("1:3").has_row_range(1));
        assert!(RefRangeBounds::test_a1("1:3").has_row_range(2));
        assert!(RefRangeBounds::test_a1("1:3").has_row_range(3));
        assert!(!RefRangeBounds::test_a1("1:3").has_row_range(4));

        assert!(!RefRangeBounds::test_a1("A1").has_row_range(1));
        assert!(!RefRangeBounds::test_a1("A").has_row_range(1));
        assert!(!RefRangeBounds::test_a1("A1:C3").has_row_range(2));

        assert!(RefRangeBounds::test_a1("1:").has_row_range(1));
        assert!(RefRangeBounds::test_a1("1:").has_row_range(2));
        assert!(RefRangeBounds::test_a1("1:3").has_row_range(1));
        assert!(!RefRangeBounds::test_a1("1:3").has_row_range(4));

        assert!(RefRangeBounds::test_a1("*").has_row_range(1));
        assert!(RefRangeBounds::test_a1("*").has_row_range(100));

        assert!(!RefRangeBounds::test_a1("A:B").has_row_range(1));
        assert!(!RefRangeBounds::test_a1("B:").has_row_range(2));
    }

    #[test]
    fn test_selected_columns() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").selected_columns(1, 10),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").selected_columns(1, 10),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:D1").selected_columns(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:D").selected_columns(1, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").selected_columns(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:").selected_columns(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1(":D").selected_columns(2, 5),
            vec![4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("10").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("4:E").selected_columns(2, 5),
            vec![5]
        );
    }

    #[test]
    fn test_selected_rows() {
        assert_eq!(RefRangeBounds::test_a1("A1").selected_rows(1, 10), vec![1]);
        assert_eq!(RefRangeBounds::test_a1("1").selected_rows(1, 10), vec![1]);
        assert_eq!(
            RefRangeBounds::test_a1("1:3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").selected_rows(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:A4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:").selected_rows(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1(":4").selected_rows(2, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("C:E5").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("E5:C").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
    }

    #[test]
    fn test_is_single_cell() {
        assert!(RefRangeBounds::test_a1("A1").is_single_cell());
        assert!(!RefRangeBounds::test_a1("A").is_single_cell());
        assert!(!RefRangeBounds::test_a1("3").is_single_cell());
        assert!(!RefRangeBounds::test_a1("A1:B2").is_single_cell());
    }

    #[test]
    fn test_selected_columns_finite() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").selected_columns_finite(),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").selected_columns_finite(),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").selected_columns_finite(),
            vec![1, 2]
        );
        assert!(RefRangeBounds::test_a1("A1:")
            .selected_columns_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1("*")
            .selected_columns_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1(":B")
            .selected_columns_finite()
            .is_empty());
    }

    #[test]
    fn test_selected_rows_finite() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").selected_rows_finite(),
            vec![1]
        );
        assert_eq!(RefRangeBounds::test_a1("1").selected_rows_finite(), vec![1]);
        assert_eq!(
            RefRangeBounds::test_a1("1:3").selected_rows_finite(),
            vec![1, 2, 3]
        );
        assert!(RefRangeBounds::test_a1("A1:")
            .selected_rows_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1("*")
            .selected_rows_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1(":3")
            .selected_rows_finite()
            .is_empty());
    }

    #[test]
    fn test_is_all() {
        assert!(RefRangeBounds::test_a1("*").is_all());
        assert!(!RefRangeBounds::test_a1("A1").is_all());
        assert!(!RefRangeBounds::test_a1("A1:B2").is_all());
    }

    #[test]
    fn test_try_to_pos() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").try_to_pos(),
            Some(Pos::new(1, 1))
        );
        assert_eq!(RefRangeBounds::test_a1("A1:B2").try_to_pos(), None);
        assert_eq!(RefRangeBounds::test_a1("A").try_to_pos(), None);
        assert_eq!(RefRangeBounds::test_a1("1:5").try_to_pos(), None);
        assert_eq!(RefRangeBounds::test_a1("*").try_to_pos(), None);
    }

    #[test]
    fn test_to_contiguous2d_coords() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").to_contiguous2d_coords(),
            (1, 1, Some(1), Some(1))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").to_contiguous2d_coords(),
            (1, 1, Some(2), Some(2))
        );
        assert_eq!(
            RefRangeBounds::test_a1("B1:C").to_contiguous2d_coords(),
            (2, 1, Some(3), None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("2").to_contiguous2d_coords(),
            (1, 2, None, Some(2))
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").to_contiguous2d_coords(),
            (1, 1, None, None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("E:G").to_contiguous2d_coords(),
            (5, 1, Some(7), None)
        );
    }
}
