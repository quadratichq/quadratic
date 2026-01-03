//! Hash coordinate utilities

use super::constants::{HASH_HEIGHT, HASH_WIDTH};

/// Get hash coordinates for a cell position (1-indexed columns/rows)
pub fn get_hash_coords(col: i64, row: i64) -> (i64, i64) {
    // Adjust for 1-indexed: col 1-50 → hash 0, col 51-100 → hash 1, etc.
    (
        (col - 1).div_euclid(HASH_WIDTH),
        (row - 1).div_euclid(HASH_HEIGHT),
    )
}

/// Get hash key from hash coordinates
pub fn hash_key(hash_x: i64, hash_y: i64) -> u64 {
    // Combine hash coordinates into a single key
    // Using bit manipulation to support negative coordinates
    let x_bits = (hash_x as i32) as u32;
    let y_bits = (hash_y as i32) as u32;
    ((x_bits as u64) << 32) | (y_bits as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_hash_coords() {
        // 1-indexed coordinates: cols 1-50 → hash 0, cols 51-100 → hash 1
        assert_eq!(get_hash_coords(1, 1), (0, 0));
        assert_eq!(get_hash_coords(50, 100), (0, 0));
        assert_eq!(get_hash_coords(51, 101), (1, 1));
        assert_eq!(get_hash_coords(101, 201), (2, 2));

        // Edge cases for 1-indexed
        assert_eq!(get_hash_coords(0, 0), (-1, -1)); // col 0 is before col 1
        assert_eq!(get_hash_coords(-49, -99), (-1, -1));
        assert_eq!(get_hash_coords(-50, -100), (-2, -2));
    }

    #[test]
    fn test_hash_key() {
        assert_eq!(hash_key(0, 0), 0);
        assert_eq!(hash_key(1, 0), 1 << 32);
        assert_eq!(hash_key(0, 1), 1);
        assert_eq!(hash_key(1, 1), (1 << 32) | 1);
    }
}
