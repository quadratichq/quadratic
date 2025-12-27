use crate::{
    Pos, Rect,
    a1::{A1Context, UNBOUNDED},
};

use super::CellRefRange;

impl CellRefRange {
    /// Range only contains a selection within a single column
    pub fn contains_only_column(&self, column: i64) -> bool {
        match self {
            Self::Sheet { range } => range.start.col() == column && range.end.col() == column,
            Self::Table { .. } => false,
        }
    }

    /// Range only contains a selection within a single row
    pub fn contains_only_row(&self, row: i64) -> bool {
        match self {
            Self::Sheet { range } => range.start.row() == row && range.end.row() == row,
            Self::Table { .. } => false,
        }
    }

    /// Returns true if the range is a single column range.
    pub fn only_column(&self, column: i64) -> bool {
        match self {
            Self::Sheet { range } => {
                if range.start.col() != column || range.end.col() != column {
                    return false;
                }

                if range.start.row() != 1 || range.end.row() != UNBOUNDED {
                    return false;
                }
            }
            Self::Table { .. } => return false,
        }
        true
    }

    /// Returns true if the range is a single row range.
    pub fn only_row(&self, row: i64) -> bool {
        match self {
            Self::Sheet { range } => {
                if range.start.row() != row || range.end.row() != row {
                    return false;
                }

                if range.start.col() != 1 || range.end.col() != UNBOUNDED {
                    return false;
                }
            }
            Self::Table { .. } => return false,
        }
        true
    }

    /// Returns true if the range is a single position or a range that contains the given position.
    pub fn is_pos_range(&self, p1: Pos, p2: Option<Pos>, a1_context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => {
                if let Some(p2) = p2 {
                    range.start.is_pos(p1) && range.end.is_pos(p2)
                        || range.end.is_pos(p1) && range.start.is_pos(p2)
                } else {
                    range.start.is_pos(p1) && range.end.is_pos(p1)
                }
            }
            Self::Table { range } => range
                .convert_to_ref_range_bounds(false, a1_context, false, false)
                .is_some_and(|range| {
                    if let Some(p2) = p2 {
                        range.start.is_pos(p1) && range.end.is_pos(p2)
                            || range.end.is_pos(p1) && range.start.is_pos(p2)
                    } else {
                        range.start.is_pos(p1) && range.end.is_pos(p1)
                    }
                }),
        }
    }

    /// Returns true if the range is a single column range.
    pub fn is_col_range(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_col_range(),
            Self::Table { .. } => false,
        }
    }

    /// Returns true if the range contains the given column.
    pub fn has_col_range(&self, col: i64) -> bool {
        match self {
            Self::Sheet { range } => range.has_col_range(col),
            Self::Table { .. } => false,
        }
    }

    /// Returns true if the range is a single row range.
    pub fn is_row_range(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_row_range(),
            Self::Table { .. } => false,
        }
    }

    /// Returns true if the range contains the given row.
    pub fn has_row_range(&self, row: i64) -> bool {
        match self {
            Self::Sheet { range } => range.has_row_range(row),
            Self::Table { .. } => false,
        }
    }

    /// Returns the number of columns in the range.
    pub fn col_range(&self) -> i64 {
        match self {
            Self::Sheet { range } => range.col_range(),
            Self::Table { .. } => 0,
        }
    }

    /// Returns true if the range is a finite range.
    pub fn is_finite(&self) -> bool {
        match self {
            Self::Sheet { range } => range.is_finite(),
            Self::Table { .. } => true,
        }
    }

    /// Returns the largest finite rectangle that contains the range.
    pub fn to_rect(&self, a1_context: &A1Context) -> Option<Rect> {
        match self {
            Self::Sheet { range } => range.to_rect(),
            Self::Table { range } => range.to_largest_rect(a1_context),
        }
    }

    /// Returns the largest rectangle that contains the range.
    pub fn to_rect_unbounded(&self, a1_context: &A1Context) -> Option<Rect> {
        match self {
            Self::Sheet { range } => Some(range.to_rect_unbounded()),
            Self::Table { range } => range.to_largest_rect(a1_context),
        }
    }

    /// Returns the selected finite columns in the range.
    pub fn selected_columns_finite(&self, a1_context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_columns_finite(),
            Self::Table { range } => range.selected_cols_finite(a1_context),
        }
    }

    /// Returns the selected columns in the range that fall between `from` and `to`.
    pub fn selected_columns(&self, from: i64, to: i64, a1_context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_columns(from, to),
            Self::Table { range } => range.selected_cols(from, to, a1_context),
        }
    }

    /// Returns the selected finite rows in the range.
    pub fn selected_rows_finite(&self, a1_context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_rows_finite(),
            Self::Table { range } => range.selected_rows_finite(a1_context),
        }
    }

    /// Returns the selected rows in the range that fall between `from` and `to`.
    pub fn selected_rows(&self, from: i64, to: i64, a1_context: &A1Context) -> Vec<i64> {
        match self {
            Self::Sheet { range } => range.selected_rows(from, to),
            Self::Table { range } => range.selected_rows(from, to, a1_context),
        }
    }

    /// Returns the position if the range is a single cell.
    pub fn try_to_pos(&self, a1_context: &A1Context) -> Option<Pos> {
        match self {
            Self::Sheet { range } => range.try_to_pos(),
            Self::Table { range } => range.try_to_pos(a1_context),
        }
    }

    /// Returns true if the range is a single cell.
    pub fn is_single_cell(&self, a1_context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => range.is_single_cell(),
            Self::Table { range } => range.is_single_cell(a1_context),
        }
    }

    /// Returns a list of selected columns in the table.
    pub fn table_column_selection(
        &self,
        table_name: &str,
        a1_context: &A1Context,
    ) -> Option<Vec<i64>> {
        match self {
            Self::Table { range } => range.table_column_selection(table_name, a1_context),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_only_column() {
        assert!(CellRefRange::test_a1("A").only_column(1));
        assert!(CellRefRange::test_a1("B").only_column(2));
        assert!(!CellRefRange::test_a1("A2:A5").only_column(1));
        assert!(!CellRefRange::test_a1("A").only_column(2));
        assert!(!CellRefRange::test_a1("A:B").only_column(2));
        assert!(!CellRefRange::test_a1("A1").only_column(2));
        assert!(!CellRefRange::test_a1("A1:D1").only_column(1));
    }

    #[test]
    fn test_only_row() {
        assert!(CellRefRange::test_a1("2").only_row(2));
        assert!(CellRefRange::test_a1("5").only_row(5));
        assert!(!CellRefRange::test_a1("A2:D2").only_row(2));
        assert!(!CellRefRange::test_a1("2").only_row(1));
        assert!(!CellRefRange::test_a1("1:2").only_row(1));
        assert!(!CellRefRange::test_a1("A2").only_row(1));
        assert!(!CellRefRange::test_a1("A2:D2").only_row(1));
    }

    #[test]
    fn test_is_pos_range() {
        let context = A1Context::default();
        assert!(CellRefRange::test_a1("A1").is_pos_range(Pos { x: 1, y: 1 }, None, &context));
        assert!(!CellRefRange::test_a1("A1").is_pos_range(Pos { x: 2, y: 1 }, None, &context));
        assert!(!CellRefRange::test_a1("A1").is_pos_range(Pos { x: 1, y: 2 }, None, &context));
        assert!(CellRefRange::test_a1("A1:B2").is_pos_range(
            Pos { x: 1, y: 1 },
            Some(Pos { x: 2, y: 2 }),
            &context
        ));
        assert!(!CellRefRange::test_a1("A1").is_pos_range(
            Pos { x: 2, y: 1 },
            Some(Pos { x: 1, y: 1 }),
            &context
        ));
        assert!(!CellRefRange::test_a1("A1").is_pos_range(
            Pos { x: 1, y: 2 },
            Some(Pos { x: 1, y: 1 }),
            &context
        ));
    }

    #[test]
    fn test_contains_only_column() {
        assert!(CellRefRange::test_a1("A1").contains_only_column(1));
        assert!(CellRefRange::test_a1("A1:A3").contains_only_column(1));
        assert!(!CellRefRange::test_a1("A1").contains_only_column(2));
    }

    #[test]
    fn test_contains_only_row() {
        assert!(CellRefRange::test_a1("A1").contains_only_row(1));
        assert!(CellRefRange::test_a1("A1:B1").contains_only_row(1));
        assert!(!CellRefRange::test_a1("A1").contains_only_row(2));
    }

    #[test]
    fn test_is_finite() {
        assert!(CellRefRange::test_a1("A1").is_finite());
        assert!(!CellRefRange::test_a1("A").is_finite());
        assert!(!CellRefRange::test_a1("1").is_finite());
    }

    #[test]
    fn test_to_rect() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").to_rect(&context),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            CellRefRange::test_a1("A1:B2").to_rect(&context),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(CellRefRange::test_a1("A:B").to_rect(&context), None);
        assert_eq!(CellRefRange::test_a1("1:2").to_rect(&context), None);
        assert_eq!(CellRefRange::test_a1("A1:C").to_rect(&context), None);
        assert_eq!(
            CellRefRange::test_a1("A:C3").to_rect(&context),
            Some(Rect::new(1, 1, 3, 3))
        );
        assert_eq!(CellRefRange::test_a1("*").to_rect(&context), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!CellRefRange::test_a1("A1").is_col_range());
        assert!(CellRefRange::test_a1("A").is_col_range());
        assert!(!CellRefRange::test_a1("A1:C3").is_col_range());
        assert!(CellRefRange::test_a1("A:C").is_col_range());
        assert!(CellRefRange::test_a1("A1:C").is_col_range());
        assert!(!CellRefRange::test_a1("A:C1").is_col_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!CellRefRange::test_a1("A1").is_row_range());
        assert!(!CellRefRange::test_a1("A").is_row_range());
        assert!(!CellRefRange::test_a1("A1:C3").is_row_range());
        assert!(CellRefRange::test_a1("1").is_row_range());
        assert!(CellRefRange::test_a1("1:3").is_row_range());
        assert!(CellRefRange::test_a1("A1:3").is_row_range());
        assert!(!CellRefRange::test_a1("1:C3").is_row_range());
    }

    #[test]
    fn test_has_column() {
        assert!(CellRefRange::test_a1("A").has_col_range(1));
        assert!(!CellRefRange::test_a1("A").has_col_range(2));
        assert!(CellRefRange::test_a1("A:B").has_col_range(1));
        assert!(CellRefRange::test_a1("A:B").has_col_range(2));
        assert!(!CellRefRange::test_a1("A:B").has_col_range(3));

        assert!(!CellRefRange::test_a1("A1").has_col_range(1));
        assert!(!CellRefRange::test_a1("1").has_col_range(1));
        assert!(!CellRefRange::test_a1("A1:C3").has_col_range(2));
    }

    #[test]
    fn test_has_row() {
        assert!(CellRefRange::test_a1("1").has_row_range(1));
        assert!(!CellRefRange::test_a1("1").has_row_range(2));
        assert!(CellRefRange::test_a1("1:3").has_row_range(1));
        assert!(CellRefRange::test_a1("1:3").has_row_range(2));
        assert!(CellRefRange::test_a1("1:3").has_row_range(3));
        assert!(!CellRefRange::test_a1("1:3").has_row_range(4));

        assert!(!CellRefRange::test_a1("A1").has_row_range(1));
        assert!(!CellRefRange::test_a1("A").has_row_range(1));
        assert!(!CellRefRange::test_a1("A1:C3").has_row_range(2));
    }

    #[test]
    fn test_selected_columns() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_columns(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A").selected_columns(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A:B").selected_columns(1, 10, &context),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:B2").selected_columns(1, 10, &context),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:D1").selected_columns(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        // same as A1:D
        assert_eq!(
            CellRefRange::test_a1("1:D").selected_columns(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:C3").selected_columns(1, 10, &context),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:").selected_columns(1, 10, &context),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test_a1("*").selected_columns(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        // same as A1:D
        assert_eq!(
            CellRefRange::test_a1(":D").selected_columns(2, 5, &context),
            vec![2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("10").selected_columns(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        // same as A1:E
        assert_eq!(
            CellRefRange::test_a1("4:E").selected_columns(2, 5, &context),
            vec![2, 3, 4, 5]
        );
    }

    #[test]
    fn test_selected_rows() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_rows(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1").selected_rows(1, 10, &context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1:3").selected_rows(1, 10, &context),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:B2").selected_rows(1, 10, &context),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:A4").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("1:4").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:C3").selected_rows(1, 10, &context),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test_a1("A1:").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        // same as A1:4
        assert_eq!(
            CellRefRange::test_a1(":4").selected_rows(2, 10, &context),
            vec![2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test_a1("*").selected_rows(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test_a1("A").selected_rows(2, 5, &context),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test_a1("C:E5").selected_rows(1, 10, &context),
            vec![1, 2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test_a1("E5:C").selected_rows(1, 10, &context),
            vec![5, 6, 7, 8, 9, 10]
        );
    }

    #[test]
    fn test_is_single_cell() {
        let context = A1Context::default();
        assert!(CellRefRange::test_a1("A1").is_single_cell(&context));
        assert!(!CellRefRange::test_a1("A").is_single_cell(&context));
        assert!(!CellRefRange::test_a1("3").is_single_cell(&context));
        assert!(!CellRefRange::test_a1("A1:B2").is_single_cell(&context));
    }

    #[test]
    fn test_selected_columns_finite() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_columns_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A").selected_columns_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("A:B").selected_columns_finite(&context),
            vec![1, 2]
        );
        assert!(
            CellRefRange::test_a1("A1:")
                .selected_columns_finite(&context)
                .is_empty()
        );
        assert!(
            CellRefRange::test_a1("*")
                .selected_columns_finite(&context)
                .is_empty()
        );
        assert_eq!(
            CellRefRange::test_a1(":B").selected_columns_finite(&context),
            vec![1, 2]
        );
    }

    #[test]
    fn test_selected_rows_finite() {
        let context = A1Context::default();
        assert_eq!(
            CellRefRange::test_a1("A1").selected_rows_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1").selected_rows_finite(&context),
            vec![1]
        );
        assert_eq!(
            CellRefRange::test_a1("1:3").selected_rows_finite(&context),
            vec![1, 2, 3]
        );
        assert!(
            CellRefRange::test_a1("A1:")
                .selected_rows_finite(&context)
                .is_empty()
        );
        assert!(
            CellRefRange::test_a1("*")
                .selected_rows_finite(&context)
                .is_empty()
        );
        assert_eq!(
            CellRefRange::test_a1(":3").selected_rows_finite(&context),
            vec![1, 2, 3]
        );
    }
}
