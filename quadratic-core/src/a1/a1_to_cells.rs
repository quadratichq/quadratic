use serde::Serialize;
use ts_rs::TS;

use super::{super::a1_sheet_name::simple_sheet_name, A1Error, A1Range, A1RangeType, A1};

/// Returned by a `cells` call in supported Quadratic languages.
#[derive(Serialize, Debug, PartialEq, TS)]
pub struct A1Cells {
    pub cells: A1RangeType,
    pub sheet_name: Option<String>,
}

impl A1 {
    /// Converts an A1 string to an A1Cells request for use by `cells` calls in
    /// supported Quadratic languages.
    ///
    /// This only supports a single A1Range by design (since it's difficult to
    /// form a rectangle from multiple ranges).
    pub fn to_cells(a1: &str) -> Result<A1Cells, A1Error> {
        let (remaining, sheet_name) = simple_sheet_name(a1)?;

        if A1Range::try_from_all(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::All,
                sheet_name,
            })
        } else if let Some(columns) = A1Range::try_from_column_range(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::ColumnRange(columns),
                sheet_name,
            })
        } else if let Some(column) = A1Range::try_from_column(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::Column(column),
                sheet_name,
            })
        } else if let Some(rows) = A1Range::try_from_row_range(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::RowRange(rows),
                sheet_name,
            })
        } else if let Some(row) = A1Range::try_from_row(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::Row(row),
                sheet_name,
            })
        } else if let Some(rect) = A1Range::try_from_rect(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::Rect(rect),
                sheet_name,
            })
        } else if let Some(pos) = A1Range::try_from_position(remaining) {
            Ok(A1Cells {
                cells: A1RangeType::Pos(pos),
                sheet_name,
            })
        } else {
            Err(A1Error::InvalidRange(a1.to_string()))
        }
    }

    /// Converts an A1 string to an A1RangeType with the same rules as to_cells.
    pub fn to_a1_range_type(a1: &str) -> Result<(A1RangeType, Option<String>), A1Error> {
        let (remaining, sheet_name) = simple_sheet_name(a1)?;

        if A1Range::try_from_all(remaining) {
            Ok((A1RangeType::All, sheet_name))
        } else if let Some(columns) = A1Range::try_from_column_range(remaining) {
            Ok((A1RangeType::ColumnRange(columns), sheet_name))
        } else if let Some(column) = A1Range::try_from_column(remaining) {
            Ok((A1RangeType::Column(column), sheet_name))
        } else if let Some(rows) = A1Range::try_from_row_range(remaining) {
            Ok((A1RangeType::RowRange(rows), sheet_name))
        } else if let Some(row) = A1Range::try_from_row(remaining) {
            Ok((A1RangeType::Row(row), sheet_name))
        } else if let Some(rect) = A1Range::try_from_rect(remaining) {
            Ok((A1RangeType::Rect(rect), sheet_name))
        } else if let Some(pos) = A1Range::try_from_position(remaining) {
            Ok((A1RangeType::Pos(pos), sheet_name))
        } else {
            Err(A1Error::InvalidRange(a1.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{RelColRow, RelColRowRange, RelPos, RelRect};

    use super::*;

    #[test]
    #[parallel]
    fn test_to_cells_all() {
        let result = A1::to_cells("*").unwrap();
        assert_eq!(result.cells, A1RangeType::All);
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_position() {
        let result = A1::to_cells("B2").unwrap();
        assert_eq!(
            result.cells,
            A1RangeType::Pos(RelPos::new(2, 2, true, true))
        );
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_column_range() {
        let result = A1::to_cells("A:C").unwrap();
        assert_eq!(
            result.cells,
            A1RangeType::ColumnRange(RelColRowRange {
                min: RelColRow::new(1, true),
                max: RelColRow::new(3, true),
            })
        );
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_single_column() {
        let result = A1::to_cells("B").unwrap();
        assert_eq!(result.cells, A1RangeType::Column(RelColRow::new(2, true)));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_row_range() {
        let result = A1::to_cells("1:3").unwrap();
        assert_eq!(
            result.cells,
            A1RangeType::RowRange(RelColRowRange {
                min: RelColRow::new(1, true),
                max: RelColRow::new(3, true),
            })
        );
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_single_row() {
        let result = A1::to_cells("2").unwrap();
        assert_eq!(result.cells, A1RangeType::Row(RelColRow::new(2, true)));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_rect() {
        let result = A1::to_cells("A1:C3").unwrap();
        assert_eq!(
            result.cells,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(1, 1, true, true),
                max: RelPos::new(3, 3, true, true),
            })
        );
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_with_sheet_name() {
        let result = A1::to_cells("Sheet1!A1:C3").unwrap();
        assert_eq!(
            result.cells,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(1, 1, true, true),
                max: RelPos::new(3, 3, true, true),
            })
        );
        assert_eq!(result.sheet_name, Some("Sheet1".to_string()));
    }

    #[test]
    #[parallel]
    fn test_to_cells_invalid_range() {
        let result = A1::to_cells("InvalidRange!");
        assert!(result.is_err());
        assert!(matches!(result, Err(A1Error::InvalidRange(_))));
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_all() {
        let (range_type, sheet_name) = A1::to_a1_range_type("*").unwrap();
        assert_eq!(range_type, A1RangeType::All);
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_column_range() {
        let (range_type, sheet_name) = A1::to_a1_range_type("A:C").unwrap();
        assert_eq!(
            range_type,
            A1RangeType::ColumnRange(RelColRowRange {
                min: RelColRow::new(1, true),
                max: RelColRow::new(3, true),
            })
        );
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_single_column() {
        let (range_type, sheet_name) = A1::to_a1_range_type("B").unwrap();
        assert_eq!(range_type, A1RangeType::Column(RelColRow::new(2, true)));
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_row_range() {
        let (range_type, sheet_name) = A1::to_a1_range_type("1:3").unwrap();
        assert_eq!(
            range_type,
            A1RangeType::RowRange(RelColRowRange {
                min: RelColRow::new(1, true),
                max: RelColRow::new(3, true),
            })
        );
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_single_row() {
        let (range_type, sheet_name) = A1::to_a1_range_type("2").unwrap();
        assert_eq!(range_type, A1RangeType::Row(RelColRow::new(2, true)));
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_rect() {
        let (range_type, sheet_name) = A1::to_a1_range_type("A1:C3").unwrap();
        assert_eq!(
            range_type,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(1, 1, true, true),
                max: RelPos::new(3, 3, true, true),
            })
        );
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_position() {
        let (range_type, sheet_name) = A1::to_a1_range_type("B2").unwrap();
        assert_eq!(range_type, A1RangeType::Pos(RelPos::new(2, 2, true, true)));
        assert_eq!(sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_with_sheet_name() {
        let (range_type, sheet_name) = A1::to_a1_range_type("Sheet1!A1:C3").unwrap();
        assert_eq!(
            range_type,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(1, 1, true, true),
                max: RelPos::new(3, 3, true, true),
            })
        );
        assert_eq!(sheet_name, Some("Sheet1".to_string()));
    }

    #[test]
    #[parallel]
    fn test_to_a1_range_type_invalid_range() {
        let result = A1::to_a1_range_type("InvalidRange!");
        assert!(result.is_err());
        assert!(matches!(result, Err(A1Error::InvalidRange(_))));
    }
}
