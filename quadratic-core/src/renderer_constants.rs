use std::collections::HashSet;

use crate::Rect;

// Re-export from shared crate
pub use quadratic_core_shared::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH};

/// Returns the hashes that are covered by the given rects.
pub fn hashes_in_rects(rects: &Vec<Rect>) -> Vec<(i64, i64)> {
    let mut hashes = HashSet::new();
    for rect in rects {
        for y in rect.y_range() {
            let y_hash = (y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i64;
            for x in rect.x_range() {
                let x_hash = (x as f64 / CELL_SHEET_WIDTH as f64).floor() as i64;
                hashes.insert((x_hash, y_hash));
            }
        }
    }
    hashes.into_iter().collect()
}
