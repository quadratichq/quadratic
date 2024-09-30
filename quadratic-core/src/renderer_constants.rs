use std::collections::HashSet;

use crate::Rect;

// keep this in sync with CellsTypes.ts
pub const CELL_SHEET_WIDTH: u32 = 15;
pub const CELL_SHEET_HEIGHT: u32 = 30;

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
