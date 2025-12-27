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

pub const QUADRANT_SIZE: u64 = 16;

pub mod limits {
    /// Maximum integer range allowed.
    pub const INTEGER_RANGE_LIMIT: f64 = 100_000.0;

    /// Maximum cell range size allowed. Must be strictly less than `u32::MAX`.
    pub const CELL_RANGE_LIMIT: u32 = 1_000_000;
}

pub const DEFAULT_COLUMN_WIDTH: f64 = 100.0;
pub const DEFAULT_ROW_HEIGHT: f64 = 21.0;

pub const THUMBNAIL_WIDTH: f64 = 1280f64;
pub const THUMBNAIL_HEIGHT: f64 = THUMBNAIL_WIDTH / (16f64 / 9f64);
