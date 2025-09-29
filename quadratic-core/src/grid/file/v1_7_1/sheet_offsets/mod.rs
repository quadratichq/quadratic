//! This is a partial copy of sheet_offsets/offsets.rs that is necessary to
//! convert the pixel-sized charts to grid sized in 1.7.1. This is locked to the
//! code at that date.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ops::Range;

const DEFAULT_COLUMN_WIDTH: f64 = 100.0;
const DEFAULT_ROW_HEIGHT: f64 = 21.0;

/// Data structure that tracks column widths or row heights in pixel units,
/// optimized for converting between column/row indices and pixel units.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct Offsets {
    default: f64,
    #[serde(with = "crate::util::btreemap_serde")]
    sizes: BTreeMap<i64, f64>,
}
impl Offsets {
    pub(crate) fn import_columns(offsets: Vec<(i64, f64)>) -> Offsets {
        Offsets::from_iter(DEFAULT_COLUMN_WIDTH, offsets.iter().copied())
    }

    pub(crate) fn import_rows(offsets: Vec<(i64, f64)>) -> Offsets {
        Offsets::from_iter(DEFAULT_ROW_HEIGHT, offsets.iter().copied())
    }

    /// Constructs an `Offsets` structure from an iterator over key-values pairs.
    pub(crate) fn from_iter(default: f64, iter: impl IntoIterator<Item = (i64, f64)>) -> Self {
        Offsets {
            default,
            sizes: iter.into_iter().collect(),
        }
    }

    /// gets the position of an entry
    pub(crate) fn position(&self, mut column: i64) -> f64 {
        if column <= 0 {
            column = 1;
        }
        let xs: Vec<f64> = self
            .iter_offsets(Range {
                start: column,
                end: column + 2,
            })
            .collect();
        *xs.first().unwrap_or(&0f64)
    }

    /// Returns the width/height of a column/row.
    pub(crate) fn get_size(&self, index: i64) -> f64 {
        *self.sizes.get(&index).unwrap_or(&self.default)
    }

    /// Iterates over the pixel positions of a range of columns/rows.
    pub(crate) fn iter_offsets(&self, index_range: Range<i64>) -> impl '_ + Iterator<Item = f64> {
        let mut current_position = self.default * (index_range.start - 1) as f64
            + self
                .sizes
                .range(1..index_range.start)
                .map(|(_, v)| v - self.default)
                .sum::<f64>();
        index_range.map(move |index| {
            let ret = current_position;
            current_position += self.get_size(index);
            ret
        })
    }

    /// Returns screen position for a pixel using the cumulative sums to speed
    /// up the search.
    pub(crate) fn find_offset(&self, pixel: f64) -> (i64, f64) {
        let mut current_sum = 0.0;
        let mut current_index = 1;
        let mut current_size = self.get_size(current_index);
        while current_sum + current_size <= pixel {
            current_sum += current_size;
            current_index += 1;
            current_size = self.get_size(current_index);
        }

        (
            // Ensure the current_index is 1-based.
            current_index,
            current_sum,
        )
    }
}
