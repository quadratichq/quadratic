use serde::Serialize;
use ts_rs::TS;

use crate::Rect;

use super::{super::a1_sheet_name::simple_sheet_name, A1Error, A1Range, A1};

#[derive(Serialize, Debug, PartialEq, TS)]
pub enum A1CellsType {
    All,
    Columns(Vec<u64>),
    Rows(Vec<u64>),
    Rect(Rect),
    // todo...
    // PartialRect,
}

/// Returned by a `cells` call in supported Quadratic languages.
#[derive(Serialize, Debug, PartialEq, TS)]
pub struct A1Cells {
    pub cells: A1CellsType,
    pub sheet_name: Option<String>,
}

impl A1 {
    /// Converts an A1 string to an A1Cells request for use by `cells` calls in
    /// supported Quadratic languages.
    ///
    /// This currently only supports a single A1Range by design.
    pub fn to_cells(a1: &str) -> Result<A1Cells, A1Error> {
        let (remaining, sheet_name) = simple_sheet_name(a1)?;

        if A1Range::try_from_all(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::All,
                sheet_name,
            })
        } else if let Some(columns) = A1Range::try_from_column_range(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::Columns(columns.into()),
                sheet_name,
            })
        } else if let Some(column) = A1Range::try_from_column(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::Columns(vec![column.index]),
                sheet_name,
            })
        } else if let Some(rows) = A1Range::try_from_row_range(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::Rows(rows.into()),
                sheet_name,
            })
        } else if let Some(row) = A1Range::try_from_row(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::Rows(vec![row.index]),
                sheet_name,
            })
        } else if let Some(rect) = A1Range::try_from_rect(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::Rect(rect.into()),
                sheet_name,
            })
        } else if let Some(pos) = A1Range::try_from_position(remaining) {
            Ok(A1Cells {
                cells: A1CellsType::Rect(Rect::new(
                    pos.x.index as i64,
                    pos.y.index as i64,
                    pos.x.index as i64,
                    pos.y.index as i64,
                )),
                sheet_name,
            })
        } else {
            Err(A1Error::InvalidRange(a1.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_to_cells_all() {
        let result = A1::to_cells("*").unwrap();
        assert_eq!(result.cells, A1CellsType::All);
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_position() {
        let result = A1::to_cells("B2").unwrap();
        assert_eq!(result.cells, A1CellsType::Rect(Rect::new(2, 2, 1, 1)));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_column_range() {
        let result = A1::to_cells("A:C").unwrap();
        assert_eq!(result.cells, A1CellsType::Columns(vec![1, 2, 3]));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_single_column() {
        let result = A1::to_cells("B").unwrap();
        assert_eq!(result.cells, A1CellsType::Columns(vec![2]));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_row_range() {
        let result = A1::to_cells("1:3").unwrap();
        assert_eq!(result.cells, A1CellsType::Rows(vec![1, 2, 3]));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_single_row() {
        let result = A1::to_cells("2").unwrap();
        assert_eq!(result.cells, A1CellsType::Rows(vec![2]));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_rect() {
        let result = A1::to_cells("A1:C3").unwrap();
        assert_eq!(result.cells, A1CellsType::Rect(Rect::new(1, 1, 3, 3)));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    #[parallel]
    fn test_to_cells_with_sheet_name() {
        let result = A1::to_cells("Sheet1!A1:C3").unwrap();
        assert_eq!(result.cells, A1CellsType::Rect(Rect::new(1, 1, 3, 3)));
        assert_eq!(result.sheet_name, Some("Sheet1".to_string()));
    }

    #[test]
    #[parallel]
    fn test_to_cells_invalid_range() {
        let result = A1::to_cells("InvalidRange!");
        assert!(result.is_err());
        assert!(matches!(result, Err(A1Error::InvalidRange(_))));
    }
}
