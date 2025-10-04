use smallvec::SmallVec;

/// Returns a column's name from its number in A1 notation (where A=1, and
/// negative columns are not allowed).
pub(crate) fn column_name(mut column: i64) -> String {
    let mut result_bytes_reversed = SmallVec::<[u8; 16]>::new();
    let total_alphabet_chars = (b'Z' - b'A' + 1) as i64;

    while column > 0 {
        column -= 1;
        let char_code = (column % total_alphabet_chars) as u8 + b'A';
        result_bytes_reversed.push(char_code);
        column /= total_alphabet_chars;
    }

    // Reverse the vector and convert to string
    result_bytes_reversed
        .into_iter()
        .rev()
        .map(|c| c as char)
        .collect()
}

/// Returns the coordinate of a column from its name, or `None` if no such column exists.
///
/// A=1, B=2, ... Z=26, AA=27, etc.
pub(crate) fn column_from_name(s: &str) -> Option<i64> {
    fn digit(c: char) -> Option<u8> {
        let c = c.to_ascii_uppercase();
        c.is_ascii_uppercase().then(|| c as u8 - b'A')
    }

    let mut ret = 0_i64;
    for char in s.chars() {
        ret = ret.checked_mul(26)?.checked_add(digit(char)? as i64 + 1)?;
    }
    if ret > crate::a1::MAX_COLUMNS {
        return None;
    }

    Some(ret)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_column_name() {
        assert_eq!(column_name(1), "A");
        assert_eq!(column_name(2), "B");
        assert_eq!(column_name(26), "Z");
        assert_eq!(column_name(27), "AA");
        assert_eq!(column_name(28), "AB");
        assert_eq!(column_name(52), "AZ");
        assert_eq!(column_name(53), "BA");
        assert_eq!(column_name(702), "ZZ");
        assert_eq!(column_name(703), "AAA");
    }

    #[test]
    fn test_column_from_name() {
        assert_eq!(column_from_name("A"), Some(1));
        assert_eq!(column_from_name("B"), Some(2));
        assert_eq!(column_from_name("Z"), Some(26));
        assert_eq!(column_from_name("AA"), Some(27));
        assert_eq!(column_from_name("AB"), Some(28));
        assert_eq!(column_from_name("AZ"), Some(52));
        assert_eq!(column_from_name("BA"), Some(53));
        assert_eq!(column_from_name("ZZ"), Some(702));
        assert_eq!(column_from_name("AAA"), Some(703));

        // Edge cases
        assert_eq!(column_from_name(""), Some(0));
        assert_eq!(column_from_name("a"), Some(1)); // lowercase
        assert_eq!(column_from_name("aa"), Some(27)); // lowercase

        // Invalid inputs
        assert_eq!(column_from_name("1"), None);
        assert_eq!(column_from_name("A1"), None);
        assert_eq!(column_from_name("!"), None);
        assert_eq!(column_from_name(" "), None);
    }

    #[test]
    fn test_roundtrip() {
        // Test that converting from number to name and back gives the same number
        for i in 1..1000 {
            let name = column_name(i);
            assert_eq!(column_from_name(&name), Some(i));
        }
    }
}
