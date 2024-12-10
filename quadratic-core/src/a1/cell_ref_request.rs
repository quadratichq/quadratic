use std::{fmt, str::FromStr};

use serde::Serialize;

use super::{parse_optional_sheet_name, A1Error, CellRefRange};

/// Returned by a `cells` call in supported Quadratic languages.
///
/// This only supports a single range by design (since it's difficult to form a
/// rectangle from multiple ranges).
#[derive(Serialize, Debug, PartialEq)]
pub struct CellRefRequest {
    pub sheet_name: Option<String>,
    pub cells: CellRefRange,
}
impl fmt::Display for CellRefRequest {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(sheet) = &self.sheet_name {
            write!(f, "{}!", super::quote_sheet_name(sheet))?;
        }
        write!(f, "{}", self.cells)
    }
}
impl FromStr for CellRefRequest {
    type Err = A1Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (sheet_name, cells_str) = parse_optional_sheet_name(s)?;
        let cells = match cells_str {
            "*" => CellRefRange::ALL,
            _ => cells_str.parse()?,
        };
        Ok(Self { sheet_name, cells })
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_to_cells_all() {
        let result = CellRefRequest::from_str("*").unwrap();
        assert_eq!(result.cells, CellRefRange::ALL);
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_position() {
        let result = CellRefRequest::from_str("B2").unwrap();
        assert_eq!(result.cells, CellRefRange::new_relative_xy(2, 2));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_column_range() {
        let result = CellRefRequest::from_str("A:C").unwrap();
        assert_eq!(result.cells, CellRefRange::new_relative_column_range(1, 3));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_single_column() {
        let result = CellRefRequest::from_str("B").unwrap();
        assert_eq!(result.cells, CellRefRange::new_relative_column(2));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_row_range() {
        let result = CellRefRequest::from_str("1:3").unwrap();
        assert_eq!(result.cells, CellRefRange::new_relative_row_range(1, 3));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_single_row() {
        let result = CellRefRequest::from_str("2").unwrap();
        assert_eq!(result.cells, CellRefRange::new_relative_row(2));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_rect() {
        let result = CellRefRequest::from_str("A1:C3").unwrap();
        assert_eq!(result.cells, CellRefRange::test_a1("A1:C3"));
        assert_eq!(result.sheet_name, None);
    }

    #[test]
    fn test_to_cells_with_sheet_name() {
        let result = CellRefRequest::from_str("Sheet1!A1:C3").unwrap();
        assert_eq!(result.cells, CellRefRange::test_a1("A1:C3"),);
        assert_eq!(result.sheet_name, Some("Sheet1".to_string()));
    }

    #[test]
    fn test_to_cells_invalid_range() {
        let result = CellRefRequest::from_str("InvalidRange!");
        assert!(result.is_err());
        assert!(matches!(result, Err(A1Error::InvalidRange(_))));
    }
}
