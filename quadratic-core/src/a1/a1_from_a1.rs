use crate::{Pos, Rect};

use super::{A1Error, A1};

impl A1 {
    /// Checks for all notation
    pub fn try_from_all(a1: &str) -> bool {
        a1.contains("*")
    }

    /// Tries to convert an A1 part to a column.
    pub fn try_from_column(a1: &str) -> Option<u64> {
        let a1 = a1.trim().replace("$", "").to_uppercase();
        if a1.is_empty() {
            return None;
        }

        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut result = 0;
        for (i, &c) in a1.as_bytes().iter().rev().enumerate() {
            if !c.is_ascii_uppercase() {
                return None;
            }
            result += (c - b'A' + 1) as u64 * total_alphabets.pow(i as u32);
        }
        Some(result)
    }

    /// Get a column from an A1 string and automatically unwrap it (only used
    /// for tests).
    #[cfg(test)]
    pub fn column(a1_column: &str) -> i64 {
        A1::try_from_column(a1_column).unwrap() as i64
    }

    /// Tries to convert an A1 part to a row.
    pub fn try_from_row(a1: &str) -> Option<u64> {
        let a1 = a1.trim().replace("$", "");
        if a1.is_empty() {
            return None;
        }
        match a1.parse::<u64>() {
            Ok(x) => {
                if x > 0 {
                    Some(x)
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }

    /// Tries to create a Pos from an A1 string.
    pub fn try_from_pos(a1: &str) -> Option<Pos> {
        let a1 = a1.trim().replace("$", "");

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

    /// Tries to create a Rect from an A1 string.
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

    /// Tries to create Column(s) from an A1 string. Returns a vector of column.
    pub fn try_from_columns(a1: &str) -> Option<Vec<u64>> {
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
            .unwrap_or_else(|| A1::try_from_column(&a1).map(|x| vec![x]))
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

    /// Gets the sheet name from an a1 string if present. Returns (the remaining
    /// string, sheet name) or any error.
    pub fn try_sheet_name(a1: &str) -> Result<(&str, Option<&str>), A1Error> {
        // Count the number of exclamation marks in the A1 string
        let exclamation_count = a1.chars().filter(|&c| c == '!').count();

        // If there are more than one exclamation mark, return an error
        if exclamation_count > 1 {
            return Err(A1Error::TooManySheets);
        }
        if exclamation_count == 1 {
            let Some((sheet_name, remaining)) = a1.split_once('!') else {
                return Err(A1Error::TooManySheets);
            };
            // Remove single quotes around sheet name if present
            let sheet_name = sheet_name.trim_matches('\'');
            Ok((remaining, Some(sheet_name)))
        } else {
            Ok((a1, None))
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

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

    #[test]
    #[parallel]
    fn test_try_sheet_name() {
        assert_eq!(A1::try_sheet_name("Sheet1!A1"), Ok(("A1", Some("Sheet1"))));
        assert_eq!(
            A1::try_sheet_name("'Sheet 1'!A1"),
            Ok(("A1", Some("Sheet 1")))
        );
        assert_eq!(A1::try_sheet_name("A1"), Ok(("A1", None)));
        assert_eq!(
            A1::try_sheet_name("Sheet1!A1:B2"),
            Ok(("A1:B2", Some("Sheet1")))
        );
        assert!(matches!(
            A1::try_sheet_name("Sheet1!Sheet2!A1"),
            Err(A1Error::TooManySheets)
        ));
    }

    #[test]
    #[parallel]
    fn test_try_from_all() {
        assert!(A1::try_from_all("*"));
        assert!(!A1::try_from_all("A1"));
    }
}
