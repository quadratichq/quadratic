//! A1 Notation utilities for spreadsheet column/row labels
//!
//! Converts column numbers to letters (A, B, ... Z, AA, AB, ...) and row numbers to strings.

/// Convert a column number (1-indexed) to A1 notation letters
///
/// Examples:
/// - 1 -> "A"
/// - 2 -> "B"
/// - 26 -> "Z"
/// - 27 -> "AA"
/// - 28 -> "AB"
/// - 702 -> "ZZ"
/// - 703 -> "AAA"
pub fn column_to_a1(column: i64) -> String {
    if column <= 0 {
        return String::new();
    }

    let mut result = String::new();
    let mut n = column - 1; // Convert to 0-indexed

    loop {
        let remainder = (n % 26) as u8;
        result.insert(0, (b'A' + remainder) as char);
        n = n / 26 - 1;
        if n < 0 {
            break;
        }
    }

    result
}

/// Convert a row number (1-indexed) to string
///
/// Simply returns the number as a string.
pub fn row_to_a1(row: i64) -> String {
    if row <= 0 {
        return String::new();
    }
    row.to_string()
}

/// Convert column and row to full A1 notation (e.g., "A1", "B2", "AA100")
pub fn to_a1(column: i64, row: i64) -> String {
    format!("{}{}", column_to_a1(column), row_to_a1(row))
}

/// Calculate the width of a column label in characters
pub fn column_label_width(column: i64) -> usize {
    if column <= 0 {
        return 0;
    }
    column_to_a1(column).len()
}

/// Calculate the width of a row label in characters
pub fn row_label_width(row: i64) -> usize {
    if row <= 0 {
        return 0;
    }
    row.to_string().len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_column_to_a1() {
        assert_eq!(column_to_a1(1), "A");
        assert_eq!(column_to_a1(2), "B");
        assert_eq!(column_to_a1(26), "Z");
        assert_eq!(column_to_a1(27), "AA");
        assert_eq!(column_to_a1(28), "AB");
        assert_eq!(column_to_a1(52), "AZ");
        assert_eq!(column_to_a1(53), "BA");
        assert_eq!(column_to_a1(702), "ZZ");
        assert_eq!(column_to_a1(703), "AAA");
    }

    #[test]
    fn test_row_to_a1() {
        assert_eq!(row_to_a1(1), "1");
        assert_eq!(row_to_a1(10), "10");
        assert_eq!(row_to_a1(100), "100");
        assert_eq!(row_to_a1(1000), "1000");
    }

    #[test]
    fn test_to_a1() {
        assert_eq!(to_a1(1, 1), "A1");
        assert_eq!(to_a1(2, 3), "B3");
        assert_eq!(to_a1(27, 100), "AA100");
    }

    #[test]
    fn test_invalid_inputs() {
        assert_eq!(column_to_a1(0), "");
        assert_eq!(column_to_a1(-1), "");
        assert_eq!(row_to_a1(0), "");
        assert_eq!(row_to_a1(-1), "");
    }
}
