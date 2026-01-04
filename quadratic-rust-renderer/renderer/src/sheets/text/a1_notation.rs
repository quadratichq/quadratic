//! A1 notation utilities for column/row labels
//!
//! Converts between column/row numbers and A1-style notation (A, B, ... Z, AA, AB, etc.)

/// Convert a 1-indexed column number to A1 notation (A, B, ... Z, AA, AB, ...)
///
/// # Examples
/// ```ignore
/// assert_eq!(column_to_a1(1), "A");
/// assert_eq!(column_to_a1(26), "Z");
/// assert_eq!(column_to_a1(27), "AA");
/// assert_eq!(column_to_a1(702), "ZZ");
/// assert_eq!(column_to_a1(703), "AAA");
/// ```
pub fn column_to_a1(col: i64) -> String {
    if col <= 0 {
        return String::new();
    }

    let mut result = String::new();
    let mut n = col;

    while n > 0 {
        n -= 1; // Adjust for 0-based calculation
        let remainder = (n % 26) as u8;
        result.insert(0, (b'A' + remainder) as char);
        n /= 26;
    }

    result
}

/// Convert a 1-indexed row number to a string (simply the number itself)
///
/// # Examples
/// ```ignore
/// assert_eq!(row_to_a1(1), "1");
/// assert_eq!(row_to_a1(100), "100");
/// ```
pub fn row_to_a1(row: i64) -> String {
    row.to_string()
}

/// Convert column and row to A1 notation (e.g., "A1", "B2", "AA100")
///
/// # Examples
/// ```ignore
/// assert_eq!(to_a1(1, 1), "A1");
/// assert_eq!(to_a1(27, 100), "AA100");
/// ```
pub fn to_a1(col: i64, row: i64) -> String {
    format!("{}{}", column_to_a1(col), row_to_a1(row))
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
        assert_eq!(row_to_a1(100), "100");
        assert_eq!(row_to_a1(1000000), "1000000");
    }

    #[test]
    fn test_to_a1() {
        assert_eq!(to_a1(1, 1), "A1");
        assert_eq!(to_a1(2, 5), "B5");
        assert_eq!(to_a1(27, 100), "AA100");
    }

    #[test]
    fn test_edge_cases() {
        assert_eq!(column_to_a1(0), "");
        assert_eq!(column_to_a1(-1), "");
    }
}
