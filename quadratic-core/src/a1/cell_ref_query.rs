use crate::Pos;

use super::CellRefRange;

impl CellRefRange {
    pub fn only_column(&self, column: u64) -> bool {
        match self {
            Self::Sheet { range } => {
                // if there is no start column, then it's not a single column range
                let Some(start_col) = range.start.col else {
                    return false;
                };

                // if the start column is not the column we're checking for, then it's not a
                // single column range
                if start_col.coord != column {
                    return false;
                }

                // if there is no end column, then it's a single column range
                let Some(end) = range.end.as_ref().and_then(|end| end.col) else {
                    return true;
                };

                end.coord == column
            }
        }
    }

    pub fn only_row(&self, row: u64) -> bool {
        match self {
            Self::Sheet { range } => {
                // if there is not start row, then it's not a single row range
                let Some(start_row) = range.start.row else {
                    return false;
                };

                // if the start row is not the row we're checking for, then it's not a
                // single row range
                if start_row.coord != row {
                    return false;
                }

                // if there is no end row, then it's a single row range
                let Some(end) = range.end.as_ref().and_then(|end| end.row) else {
                    return true;
                };

                end.coord == row
            }
        }
    }

    pub fn is_empty(&self) -> bool {
        match self {
            Self::Sheet { range } => range.start.row.is_none() && range.start.col.is_none(),
        }
    }

    pub fn is_pos_range(&self, p1: Pos, p2: Option<Pos>) -> bool {
        match self {
            Self::Sheet { range } => {
                if range.start.is_pos(p1) {
                    if let Some(p2) = p2 {
                        range.end.is_some_and(|end| end.is_pos(p2))
                    } else {
                        p2.is_none() && range.end.is_none()
                    }
                } else if range.end.is_some_and(|end| end.is_pos(p1)) {
                    p2.is_some_and(|p2| range.start.is_pos(p2))
                } else {
                    false
                }
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
        assert!(CellRefRange::test("A").only_column(1));
        assert!(CellRefRange::test("A2:A5").only_column(1));

        assert!(!CellRefRange::test("A").only_column(2));
        assert!(!CellRefRange::test("A:B").only_column(2));
        assert!(!CellRefRange::test("A1").only_column(2));
        assert!(!CellRefRange::test("A1:D1").only_column(1));
    }

    #[test]
    fn test_only_row() {
        assert!(CellRefRange::test("2").only_row(2));
        assert!(CellRefRange::test("A2:D2").only_row(2));

        assert!(!CellRefRange::test("2").only_row(1));
        assert!(!CellRefRange::test("1:2").only_row(1));
        assert!(!CellRefRange::test("A2").only_row(1));
        assert!(!CellRefRange::test("A2:D2").only_row(1));
    }

    #[test]
    fn test_is_pos_range() {
        assert!(CellRefRange::test("A1").is_pos_range(Pos { x: 1, y: 1 }, None));
        assert!(!CellRefRange::test("A1").is_pos_range(Pos { x: 2, y: 1 }, None));
        assert!(!CellRefRange::test("A1").is_pos_range(Pos { x: 1, y: 2 }, None));
        assert!(
            CellRefRange::test("A1:B2").is_pos_range(Pos { x: 1, y: 1 }, Some(Pos { x: 2, y: 2 }))
        );
        assert!(
            !CellRefRange::test("A1").is_pos_range(Pos { x: 2, y: 1 }, Some(Pos { x: 1, y: 1 }))
        );
        assert!(
            !CellRefRange::test("A1").is_pos_range(Pos { x: 1, y: 2 }, Some(Pos { x: 1, y: 1 }))
        );
    }
}
