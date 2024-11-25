use smallvec::SmallVec;

/// Returns a column's name from its number in A1 notation (where A=1, and
/// negative columns are not allowed).
pub fn column_name(mut column: u64) -> String {
    let mut result_bytes_reversed = SmallVec::<[u8; 16]>::new();
    let total_alphabet_chars = (b'Z' - b'A' + 1) as u64;

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
pub fn column_from_name(s: &str) -> Option<u64> {
    fn digit(c: char) -> Option<u8> {
        let c = c.to_ascii_uppercase();
        c.is_ascii_uppercase().then(|| c as u8 - b'A')
    }

    let mut ret = 0_u64;
    for char in s.chars() {
        ret = ret.checked_mul(26)?.checked_add(digit(char)? as u64 + 1)?;
    }

    Some(ret)
}
