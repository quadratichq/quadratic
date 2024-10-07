use crate::Pos;

use super::{A1Range, A1};

impl A1 {
    /// Convert column (x) to A1 notation
    pub fn x_to_a1(column: u64) -> String {
        let mut a1_notation = Vec::new();
        let total_alphabets = (b'Z' - b'A' + 1) as u64;
        let mut block = column;

        while block > 0 {
            block -= 1;
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

    /// Helper function to convert an A1 string to a Pos. Returns an Option and
    /// replaces errors with None..
    pub fn try_from_pos(a1: &str) -> Option<Pos> {
        if a1.contains(" ") || a1.contains("!") {
            return None;
        }
        if let Ok(rel_pos) = A1Range::try_from_position(a1) {
            rel_pos.map(|rel_pos| rel_pos.into())
        } else {
            None
        }
    }

    /// Get a column from an A1 string and automatically unwrap it (only used
    /// for tests).
    #[cfg(test)]
    pub fn column(a1_column: &str) -> i64 {
        A1Range::try_from_column(a1_column).unwrap().index as i64
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
    fn test_try_from_pos() {
        assert_eq!(A1::try_from_pos("A1"), Some(Pos::new(1, 1)));
        assert_eq!(A1::try_from_pos("B2"), Some(Pos::new(2, 2)));
        assert_eq!(A1::try_from_pos("C3"), Some(Pos::new(3, 3)));
        assert_eq!(A1::try_from_pos("D4"), Some(Pos::new(4, 4)));
        assert_eq!(A1::try_from_pos("E5"), Some(Pos::new(5, 5)));
        assert_eq!(A1::try_from_pos("F6"), Some(Pos::new(6, 6)));
        assert_eq!(A1::try_from_pos("Sheet 1!A1"), None);
        assert_eq!(A1::try_from_pos("A1!"), None);
        assert_eq!(A1::try_from_pos("A!1"), None);
        assert_eq!(A1::try_from_pos("!A1"), None);
        assert_eq!(A1::try_from_pos("A"), None);
        assert_eq!(A1::try_from_pos("3"), None);
        assert_eq!(A1::try_from_pos("*"), None);
        assert_eq!(A1::try_from_pos(""), None);
        assert_eq!(A1::try_from_pos(" "), None);
    }
}
