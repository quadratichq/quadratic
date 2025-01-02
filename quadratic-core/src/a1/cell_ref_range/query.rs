use crate::{
    a1::{A1Context, UNBOUNDED},
    Pos,
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
    pub fn is_pos_range(&self, p1: Pos, p2: Option<Pos>, context: &A1Context) -> bool {
        match self {
            Self::Sheet { range } => {
                if let Some(p2) = p2 {
                    range.start.is_pos(p1) && range.end.is_pos(p2)
                        || range.end.is_pos(p1) && range.start.is_pos(p2)
                } else {
                    range.start.is_pos(p1) && range.end.is_pos(p1)
                }
            }
            Self::Table { range } => {
                range
                    .convert_to_ref_range_bounds(0, context)
                    .iter()
                    .any(|range| {
                        if let Self::Sheet { range } = range {
                            if let Some(p2) = p2 {
                                range.start.is_pos(p1) && range.end.is_pos(p2)
                                    || range.end.is_pos(p1) && range.start.is_pos(p2)
                            } else {
                                range.start.is_pos(p1) && range.end.is_pos(p1)
                            }
                        } else {
                            false
                        }
                    })
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
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
}
