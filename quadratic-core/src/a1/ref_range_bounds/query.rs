use crate::{a1::UNBOUNDED, util::sort_bounds};

use super::*;

impl RefRangeBounds {
    /// Returns whether `self` is a single column or a column range.
    pub(crate) fn is_col_range(&self) -> bool {
        self.start.row() == 1 && self.end.row() == UNBOUNDED
    }

    /// Returns the number of columns in the range.
    pub(crate) fn col_range(&self) -> i64 {
        self.end.row() - self.start.row()
    }

    /// Returns whether `self` is a multi-cursor.
    pub(crate) fn is_multi_cursor(&self) -> bool {
        self.start != self.end
    }

    /// Returns whether `self` is the entire range.
    pub(crate) fn is_all(&self) -> bool {
        self == &Self::ALL
    }

    /// Returns whether `self` contains the column `col` in its column range.
    pub(crate) fn has_col_range(&self, col: i64) -> bool {
        if !self.is_col_range() {
            return false;
        }
        let min = if self.start.col.is_unbounded() {
            1
        } else {
            self.start.col()
        };
        let max = self.end.col().max(self.start.col());
        col >= min && col <= max
    }

    /// Returns whether `self` is a single row or a row range.
    pub(crate) fn is_row_range(&self) -> bool {
        self.start.col() == 1 && self.end.col() == UNBOUNDED
    }

    /// Returns whether `self` contains the row `row` in its row range.
    pub(crate) fn has_row_range(&self, row: i64) -> bool {
        if !self.is_row_range() {
            return false;
        }
        let min = if self.start.row.is_unbounded() {
            1
        } else {
            self.start.row()
        };
        let max = self.end.row().max(self.start.row());
        row >= min && row <= max
    }

    /// Returns whether `self` is a finite range.
    pub(crate) fn is_finite(&self) -> bool {
        self.start.col() != UNBOUNDED
            && self.start.row() != UNBOUNDED
            && self.end.col() != UNBOUNDED
            && self.end.row() != UNBOUNDED
    }

    /// Returns true if the range is a single cell.
    pub(crate) fn is_single_cell(&self) -> bool {
        self.start == self.end && !self.start.col.is_unbounded() && !self.start.row.is_unbounded()
    }

    /// Tries to convert the range to a single cell position. This will only
    /// return Some if the range is a single cell.
    pub(crate) fn try_to_pos(&self) -> Option<Pos> {
        if self.is_single_cell() {
            Some(Pos {
                x: self.start.col(),
                y: self.start.row(),
            })
        } else {
            None
        }
    }

    /// Returns a rectangle that may contain an unbounded range.
    pub(crate) fn as_rect_unbounded(&self) -> Rect {
        Rect::new(
            self.start.col(),
            self.start.row(),
            self.end.col(),
            self.end.row(),
        )
    }

    /// Returns a rectangle that bounds a finite range.
    pub(crate) fn as_rect(&self) -> Option<Rect> {
        if self.is_finite() {
            Some(Rect::new(
                self.start.col(),
                self.start.row(),
                self.end.col(),
                self.end.row(),
            ))
        } else {
            None
        }
    }

    /// Returns only the finite columns in the range.
    pub(crate) fn selected_columns_finite(&self) -> Vec<i64> {
        let mut columns = vec![];
        if !self.end.col.is_unbounded() {
            let min = self.start.col().min(self.end.col());
            let max = self.start.col().max(self.end.col());
            columns.extend(min..=max);
        }
        columns
    }

    /// Returns the selected columns in the range that fall between `from` and `to`.
    pub(crate) fn selected_columns(&self, from: i64, to: i64) -> Vec<i64> {
        let mut columns = vec![];
        let min = self.start.col().min(self.end.col()).max(from);
        let max = self.start.col().max(self.end.col()).min(to);
        if min <= max {
            columns.extend(min..=max);
        }
        columns
    }

    /// Returns only the finite rows in the range.
    pub(crate) fn selected_rows_finite(&self) -> Vec<i64> {
        let mut rows = vec![];
        if !self.end.row.is_unbounded() {
            let min = self.start.row().min(self.end.row());
            let max = self.start.row().max(self.end.row());
            rows.extend(min..=max);
        }
        rows
    }

    /// Returns the selected rows in the range that fall between `from` and `to`.
    pub(crate) fn selected_rows(&self, from: i64, to: i64) -> Vec<i64> {
        let mut rows = vec![];
        let min = self.start.row().min(self.end.row()).max(from);
        let max = self.start.row().max(self.end.row()).min(to);
        if min <= max {
            rows.extend(min..=max);
        }
        rows
    }

    /// Converts the CellRefRange to coordinates to be used in Contiguous2D.
    pub(crate) fn as_contiguous2d_coords(&self) -> (i64, i64, Option<i64>, Option<i64>) {
        let (x1, y1, x2, y2) = (
            if self.start.col.is_unbounded() {
                1
            } else {
                self.start.col()
            },
            if self.start.row.is_unbounded() {
                1
            } else {
                self.start.row()
            },
            if self.end.col.is_unbounded() {
                None
            } else {
                Some(self.end.col())
            },
            if self.end.row.is_unbounded() {
                None
            } else {
                Some(self.end.row())
            },
        );
        let (x1, x2) = sort_bounds(x1, x2);
        let (y1, y2) = sort_bounds(y1, y2);
        (x1, y1, x2, y2)
    }

    /// Returns the cursor position from the last range.
    pub(crate) fn cursor_pos_from_last_range(&self) -> Pos {
        let x = self.start.col();
        let y = self.start.row();
        Pos { x, y }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_finite() {
        assert!(RefRangeBounds::test_a1("A1").is_finite());
        assert!(!RefRangeBounds::test_a1("A").is_finite());
        assert!(!RefRangeBounds::test_a1("A:").is_finite());
        assert!(!RefRangeBounds::test_a1("1").is_finite());
        assert!(!RefRangeBounds::test_a1("1:").is_finite());
        assert!(!RefRangeBounds::test_a1("*").is_finite());
        assert!(!RefRangeBounds::test_a1("A3:").is_finite());
    }

    #[test]
    fn test_to_rect() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").as_rect(),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").as_rect(),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(RefRangeBounds::test_a1("A:B").as_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("1:2").as_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("A1:C").as_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("C3:A").as_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("*").as_rect(), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!RefRangeBounds::test_a1("A1").is_col_range());
        assert!(RefRangeBounds::test_a1("A").is_col_range());
        assert!(!RefRangeBounds::test_a1("A1:C3").is_col_range());
        assert!(RefRangeBounds::test_a1("A:C").is_col_range());
        assert!(RefRangeBounds::test_a1("A1:C").is_col_range());
        assert!(RefRangeBounds::test_a1("C1:A").is_col_range());
        assert!(RefRangeBounds::test_a1("*").is_col_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!RefRangeBounds::test_a1("A1").is_row_range());
        assert!(!RefRangeBounds::test_a1("A").is_row_range());
        assert!(!RefRangeBounds::test_a1("C3:A").is_row_range());
        assert!(RefRangeBounds::test_a1("1").is_row_range());
        assert!(RefRangeBounds::test_a1("1:3").is_row_range());
        assert!(RefRangeBounds::test_a1("A1:3").is_row_range());
        assert!(!RefRangeBounds::test_a1("C3:1").is_row_range());
        assert!(RefRangeBounds::test_a1("*").is_row_range());
    }

    #[test]
    fn test_has_column_range() {
        assert!(RefRangeBounds::test_a1("A").has_col_range(1));
        assert!(!RefRangeBounds::test_a1("A").has_col_range(2));
        assert!(RefRangeBounds::test_a1("A:B").has_col_range(1));
        assert!(RefRangeBounds::test_a1("A:B").has_col_range(2));
        assert!(!RefRangeBounds::test_a1("A:B").has_col_range(3));

        assert!(!RefRangeBounds::test_a1("A1").has_col_range(1));
        assert!(!RefRangeBounds::test_a1("1").has_col_range(1));
        assert!(RefRangeBounds::test_a1("A1:C").has_col_range(2));

        assert!(!RefRangeBounds::test_a1("A1:C3").has_col_range(2));

        assert!(RefRangeBounds::test_a1("A:").has_col_range(1));
        assert!(!RefRangeBounds::test_a1("D:").has_col_range(1));
        assert!(RefRangeBounds::test_a1("D:").has_col_range(col![E]));

        assert!(RefRangeBounds::test_a1("*").has_col_range(col![E]));
        assert!(!RefRangeBounds::test_a1("3:").has_col_range(col![A]));

        // since this is the same as * it should be true
        assert!(RefRangeBounds::test_a1("1:").has_col_range(col![A]));
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

        // since this is the same as * it should be true
        assert!(RefRangeBounds::test_a1("1:").has_row_range(1));
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
            vec![2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("10").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        // same as A1:D
        assert_eq!(
            RefRangeBounds::test_a1("1:D").selected_columns(1, 10),
            vec![1, 2, 3, 4]
        );
        // same as A4:E
        assert_eq!(
            RefRangeBounds::test_a1("4:E").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
    }

    #[test]
    fn test_selected_reverse() {
        assert_eq!(
            RefRangeBounds::test_a1("C:A").selected_columns(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("3:1").selected_rows(1, 10),
            vec![1, 2, 3]
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
            vec![2, 3, 4]
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
            vec![1, 2, 3, 4, 5]
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
        assert!(
            RefRangeBounds::test_a1("A1:")
                .selected_columns_finite()
                .is_empty()
        );
        assert!(
            RefRangeBounds::test_a1("*")
                .selected_columns_finite()
                .is_empty()
        );
        assert_eq!(
            RefRangeBounds::test_a1(":B").selected_columns_finite(),
            vec![1, 2]
        );
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
        assert!(
            RefRangeBounds::test_a1("A1:")
                .selected_rows_finite()
                .is_empty()
        );
        assert!(
            RefRangeBounds::test_a1("*")
                .selected_rows_finite()
                .is_empty()
        );
        assert_eq!(
            RefRangeBounds::test_a1(":3").selected_rows_finite(),
            vec![1, 2, 3]
        );
    }

    #[test]
    fn test_is_all() {
        assert!(RefRangeBounds::test_a1("*").is_all());
        assert!(RefRangeBounds::test_a1("A:").is_all());
        assert!(RefRangeBounds::test_a1("1:").is_all());
        assert!(RefRangeBounds::test_a1("A1:").is_all());
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
    fn test_as_contiguous2d_coords() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").as_contiguous2d_coords(),
            (1, 1, Some(1), Some(1))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").as_contiguous2d_coords(),
            (1, 1, Some(2), Some(2))
        );
        assert_eq!(
            RefRangeBounds::test_a1("B1:C").as_contiguous2d_coords(),
            (2, 1, Some(3), None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("2").as_contiguous2d_coords(),
            (1, 2, None, Some(2))
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").as_contiguous2d_coords(),
            (1, 1, None, None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("E:G").as_contiguous2d_coords(),
            (5, 1, Some(7), None)
        );
    }

    #[test]
    fn test_to_rect_unbounded() {
        assert_eq!(
            RefRangeBounds::test_a1("*").as_rect_unbounded(),
            Rect::new(1, 1, UNBOUNDED, UNBOUNDED)
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:").as_rect_unbounded(),
            Rect::new(1, 1, UNBOUNDED, UNBOUNDED)
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:").as_rect_unbounded(),
            Rect::new(1, 1, UNBOUNDED, UNBOUNDED)
        );
        assert_eq!(
            RefRangeBounds::test_a1("B3:D5").as_rect_unbounded(),
            Rect::test_a1("B3:D5")
        );
    }

    #[test]
    fn test_cursor_pos_from_last_range() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").cursor_pos_from_last_range(),
            pos![A1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").cursor_pos_from_last_range(),
            pos![A1]
        );
    }
}
