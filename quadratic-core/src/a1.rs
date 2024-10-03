use std::collections::HashMap;

use serde::Serialize;
use ts_rs::TS;

use crate::{grid::SheetId, Pos, Rect};

pub type SheetNameIdMap = HashMap<String, SheetId>;

#[derive(Serialize, Debug, Clone, PartialEq, Eq, TS)]
pub enum A1Error {
    InvalidSheetId(String),
    InvalidSheetMap(String),
    InvalidColumn(String),
    InvalidSheetName(String),
    TooManySheets,
}

impl From<A1Error> for String {
    fn from(error: A1Error) -> Self {
        serde_json::to_string(&error)
            .unwrap_or(format!("Failed to convert A1Error to string: {:?}", error))
    }
}

pub struct A1 {}

impl A1 {
    /// Convert column (x) to A1 notation
    pub fn x_to_a1(column: u64) -> String {
        let mut a1_notation = Vec::new();
        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut block = column;

        while block > 0 {
            block -= 1; // Subtract 1 before calculating the character
            let char_code = (block % total_alphabets) as u8 + b'A';
            a1_notation.push(char_code as char);
            block /= total_alphabets;
        }

        // Reverse the vector and convert to string
        a1_notation.reverse();
        a1_notation.into_iter().collect()
    }

    /// Converts a position to an A1-style string.
    pub fn pos_to_a1(x: u64, y: u64) -> String {
        format!("{}{}", A1::x_to_a1(x), y)
    }

    /// Convert A1 notation column to a column index
    pub fn try_from_column(a1_column: &str) -> Option<u64> {
        let a1_column = a1_column.trim().to_uppercase();
        if a1_column.is_empty() {
            return None;
        }

        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut result = 0;
        for (i, &c) in a1_column.as_bytes().iter().rev().enumerate() {
            if !c.is_ascii_uppercase() {
                return None;
            }
            result += (c - b'A' + 1) as u64 * total_alphabets.pow(i as u32);
        }
        Some(result)
    }

    /// Try to create a row from an A1 string.
    pub fn try_from_row(row: &str) -> Option<u64> {
        row.parse::<u64>()
            .ok()
            .and_then(|n| if n > 0 { Some(n) } else { None })
    }

    /// Get a column from an A1 string and automatically unwrap it (only used
    /// for tests).
    #[cfg(test)]
    pub fn column(a1_column: &str) -> i64 {
        A1::try_from_column(a1_column).unwrap() as i64
    }

    /// Tries to create a Pos from an A1 string.
    pub fn try_from_pos(a1: &str) -> Option<Pos> {
        // Find the index where the digits start
        let number_digit = a1.find(char::is_numeric)?;

        if number_digit == 0 {
            return None;
        }

        // Split the string into column and row parts
        let (column, row) = a1.split_at(number_digit);

        // Parse the column part
        let x = A1::try_from_column(column)?;

        // Parse the row part
        let y = A1::try_from_row(row)?;

        Some(Pos::new(x as i64, y as i64))
    }

    /// Try to create a rect from an A1 range.
    pub fn try_from_range(range: &str) -> Option<Rect> {
        if let Some((from, to)) = range.split_once(':') {
            let from = A1::try_from_pos(from)?;
            let to = A1::try_from_pos(to)?;

            // rationalize the rect
            let x1 = from.x.min(to.x);
            let y1 = from.y.min(to.y);
            let x2 = from.x.max(to.x);
            let y2 = from.y.max(to.y);

            Some(Rect::new(x1, y1, x2, y2))
        } else {
            None
        }
    }

    /// Tries to create Column(s) from an A1 string.
    pub fn try_from_columns(a1: &str) -> Option<Vec<u64>> {
        // try multiple columns
        a1.split_once(':')
            .map(|(from, to)| {
                let (from, to) = match (A1::try_from_column(from), A1::try_from_column(to)) {
                    (Some(a), Some(b)) => (a.min(b), a.max(b)),

                    // handles the case of a "A:" (partially inputted range)
                    (Some(a), None) => (a, a),
                    _ => return None,
                };
                Some((from..=to).collect())
            })
            .unwrap_or_else(|| A1::try_from_column(a1).map(|x| vec![x]))
    }

    /// Tries to create Row(s) from an A1 string.
    pub fn try_from_rows(a1: &str) -> Option<Vec<u64>> {
        a1.split_once(':')
            .map(|(from, to)| {
                let (from, to) = match (A1::try_from_row(from), A1::try_from_row(to)) {
                    (Some(a), Some(b)) => (a.min(b), a.max(b)),

                    // handles the case of a "1:" (partially inputted range)
                    (Some(a), None) => (a, a),
                    _ => return None,
                };
                Some((from..=to).collect())
            })
            .unwrap_or_else(|| A1::try_from_row(a1).map(|y| vec![y]))
    }

    // Example of how to use the Error type in a method
    pub fn some_method(input: &str) -> Result<(), A1Error> {
        if input.is_empty() {
            Err(A1Error::InvalidColumn(input.to_string()))
        } else {
            Ok(())
        }
    }
}

impl From<Pos> for String {
    fn from(pos: Pos) -> Self {
        A1::pos_to_a1(pos.x as u64, pos.y as u64)
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_to_a1_column() {
        assert_eq!(A1::x_to_a1(1), "A");
        assert_eq!(A1::x_to_a1(2), "B");
        assert_eq!(A1::x_to_a1(3), "C");
        assert_eq!(A1::x_to_a1(25), "Y");
        assert_eq!(A1::x_to_a1(26), "Z");
        assert_eq!(A1::x_to_a1(27), "AA");
    }

    #[test]
    #[parallel]
    fn test_pos_to_a1() {
        assert_eq!(A1::pos_to_a1(1, 1), "A1");
        assert_eq!(A1::pos_to_a1(2, 1), "B1");
        assert_eq!(A1::pos_to_a1(3, 1), "C1");
        assert_eq!(A1::pos_to_a1(4, 1), "D1");
        assert_eq!(A1::pos_to_a1(5, 1), "E1");
        assert_eq!(A1::pos_to_a1(6, 1), "F1");

        // Test near ±26
        assert_eq!(A1::pos_to_a1(25, 1), "Y1");
        assert_eq!(A1::pos_to_a1(26, 1), "Z1");
        assert_eq!(A1::pos_to_a1(27, 1), "AA1");
        assert_eq!(A1::pos_to_a1(28, 1), "AB1");

        // Test near ±52
        assert_eq!(A1::pos_to_a1(51, 1), "AY1");
        assert_eq!(A1::pos_to_a1(52, 1), "AZ1");
        assert_eq!(A1::pos_to_a1(53, 1), "BA1");
        assert_eq!(A1::pos_to_a1(54, 1), "BB1");

        // Test near ±702
        assert_eq!(A1::pos_to_a1(701, 1), "ZY1");
        assert_eq!(A1::pos_to_a1(702, 1), "ZZ1");
        assert_eq!(A1::pos_to_a1(703, 1), "AAA1");
        assert_eq!(A1::pos_to_a1(704, 1), "AAB1");
    }

    #[test]
    #[parallel]
    fn test_from_a1_column() {
        assert_eq!(A1::try_from_column("A"), Some(1));
        assert_eq!(A1::try_from_column("B"), Some(2));
        assert_eq!(A1::try_from_column("C"), Some(3));
        assert_eq!(A1::try_from_column("a"), Some(1));
        assert_eq!(A1::try_from_column("b"), Some(2));
        assert_eq!(A1::try_from_column("c"), Some(3));
    }

    #[test]
    #[parallel]
    fn test_from_a1() {
        assert_eq!(A1::try_from_pos("A1"), Some(Pos::new(1, 1)));
        assert_eq!(A1::try_from_pos("B2"), Some(Pos::new(2, 2)));
        assert_eq!(A1::try_from_pos("Z26"), Some(Pos::new(26, 26)));
        assert_eq!(A1::try_from_pos("AA27"), Some(Pos::new(27, 27)));
        assert_eq!(A1::try_from_pos("ZZ702"), Some(Pos::new(702, 702)));
        assert_eq!(A1::try_from_pos("a1"), Some(Pos::new(1, 1)));
        assert_eq!(A1::try_from_pos("b2"), Some(Pos::new(2, 2)));

        // Test error cases
        assert_eq!(A1::try_from_pos("A"), None);
        assert_eq!(A1::try_from_pos("1A"), None);
        assert_eq!(A1::try_from_pos("A1A"), None);
        assert_eq!(A1::try_from_pos(""), None);
    }

    #[test]
    #[parallel]
    fn test_from_a1_row() {
        assert_eq!(A1::try_from_row("1"), Some(1));
        assert_eq!(A1::try_from_row("2"), Some(2));
        assert_eq!(A1::try_from_row("3"), Some(3));
    }

    #[test]
    #[parallel]
    fn test_from_a1_columns() {
        assert_eq!(A1::try_from_columns("A"), Some(vec![1]));
        assert_eq!(A1::try_from_columns("B"), Some(vec![2]));
        assert_eq!(A1::try_from_columns("C"), Some(vec![3]));
        assert_eq!(A1::try_from_columns("A:C"), Some(vec![1, 2, 3]));
        assert_eq!(A1::try_from_columns("A:B"), Some(vec![1, 2]));
        assert_eq!(A1::try_from_columns("B:A"), Some(vec![1, 2]));
    }

    #[test]
    #[parallel]
    fn test_from_a1_rows() {
        assert_eq!(A1::try_from_rows("1"), Some(vec![1]));
        assert_eq!(A1::try_from_rows("2"), Some(vec![2]));
        assert_eq!(A1::try_from_rows("3"), Some(vec![3]));
        assert_eq!(A1::try_from_rows("1:3"), Some(vec![1, 2, 3]));
        assert_eq!(A1::try_from_rows("1:2"), Some(vec![1, 2]));
        assert_eq!(A1::try_from_rows("2:1"), Some(vec![1, 2]));
    }

    #[test]
    #[parallel]
    fn test_from_a1_range() {
        assert_eq!(
            A1::try_from_range("A1:B2"),
            Some(Rect::from_numbers(1, 1, 2, 2))
        );
        assert_eq!(A1::try_from_range("1:2"), None);
    }

    #[test]
    #[parallel]
    fn test_try_from_column_empty() {
        assert_eq!(A1::try_from_column(""), None);
    }

    #[test]
    #[parallel]
    fn test_try_from_row_zero_and_negative() {
        assert_eq!(A1::try_from_row("0"), None);
        assert_eq!(A1::try_from_row("-1"), None);
        assert_eq!(A1::try_from_row("-100"), None);
    }
}
