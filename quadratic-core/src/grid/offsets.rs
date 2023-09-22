use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ops::Range;

use itertools::Itertools;

/// Data structure that tracks column widths or row heights in pixel units,
/// optimized for converting between column/row indices and pixel units.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Offsets {
    default: f64,
    #[serde(with = "crate::util::btreemap_serde")]
    sizes: BTreeMap<i64, f64>,
}
impl Offsets {
    /// Constructs an empty `Offsets` structure.
    pub fn new(default: f64) -> Self {
        Offsets {
            default,
            sizes: BTreeMap::new(),
        }
    }

    /// Constructs an `Offsets` structure from an iterator over key-values pairs.
    pub fn from_iter(default: f64, iter: impl IntoIterator<Item = (i64, f64)>) -> Self {
        Offsets {
            default,
            sizes: iter.into_iter().collect(),
        }
    }

    /// Moves the column/row from `from_index` to `to_index`, shifting the ones
    /// between.
    #[allow(unused)] // TODO: remove this attribute. this function is tested and will be useful later
    pub fn move_elem(&mut self, from_index: i64, to_index: i64) {
        let value_to_move = self.sizes.remove(&from_index);

        let range = std::cmp::min(from_index, to_index)..=std::cmp::max(from_index, to_index);
        let delta = if from_index < to_index { -1 } else { 1 };
        let key_value_pairs = self.sizes.range(range).map(|(&k, &v)| (k, v)).collect_vec();
        for (k, _v) in &key_value_pairs {
            self.sizes.remove(k);
        }
        for (k, v) in key_value_pairs {
            self.sizes.insert(k + delta, v);
        }

        if let Some(value) = value_to_move {
            self.sizes.insert(to_index, value);
        }
    }

    /// Returns the width/height of a column/row.
    pub fn get_size(&self, index: i64) -> f64 {
        *self.sizes.get(&index).unwrap_or(&self.default)
    }
    /// Sets the width/height of a column/row.
    pub fn set_size(&mut self, index: i64, value: f64) -> f64 {
        if value == self.default {
            self.sizes.remove(&index)
        } else {
            self.sizes.insert(index, value)
        }
        .unwrap_or(self.default)
    }
    /// Resets the width/height of a column/row to the default value.
    pub fn reset(&mut self, index: i64) -> f64 {
        self.sizes.remove(&index).unwrap_or(self.default)
    }

    /// Iterates over the pixel positions of a range of columns/rows.
    pub fn iter_offsets(&self, index_range: Range<i64>) -> impl '_ + Iterator<Item = f64> {
        let start = index_range.start;
        let mut current_position = if start < 0 {
            self.default * start as f64
                - self
                    .sizes
                    .range(start..0)
                    .map(|(_k, v)| v - self.default)
                    .sum::<f64>()
        } else {
            self.default * start as f64
                + self
                    .sizes
                    .range(0..start)
                    .map(|(_k, v)| v - self.default)
                    .sum::<f64>()
        };
        index_range.map(move |index| {
            let ret = current_position;
            current_position += self.get_size(index);
            ret
        })
    }

    /// returns the entry index and screen position for a screen coordinate
    pub fn find_offset(&self, pixel: f64) -> (i64, f64) {
        if pixel >= 0.0 {
            let mut index = 0;
            let mut position = 0.0;
            let mut next_width = self.get_size(index);
            while position + next_width <= pixel {
                position += next_width;
                index += 1;
                next_width = self.get_size(index);
            }
            (index, position)
        } else {
            let mut index = -1;
            let mut position = -self.get_size(-1);
            while position > pixel {
                index -= 1;
                position -= self.get_size(index);
            }
            (index, position)
        }
    }

    /// Returns an iterator that includes all offsets for entries between the two screen coordinates
    /// (including one offset beyond the last entry to ensure we know the size of all entries)
    pub fn iter_screen_offsets(&self, pixel_range: Range<f64>) -> impl '_ + Iterator<Item = f64> {
        let start = self.find_offset(pixel_range.start).0;
        let end = self.find_offset(pixel_range.end).0;
        self.iter_offsets(Range {
            start,

            // +1 to include end, and +1 to include the next entry so we have the width of the final entry
            end: end + 2,
        })
    }

    /// Iterates over the sizes of all columns/rows.
    pub fn iter_sizes(&self) -> impl '_ + Iterator<Item = (i64, f64)> {
        self.sizes.iter().map(|(&k, &v)| (k, v))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_offsets_structure() {
        let mut offsets = Offsets::new(10.0);
        assert_eq!(offsets.get_size(0), 10.0);
        assert_eq!(
            offsets.iter_offsets(0..3).collect_vec(),
            vec![0.0, 10.0, 20.0],
        );
        assert_eq!(offsets.iter_offsets(2..3).collect_vec(), vec![20.0]);
        assert_eq!(
            offsets.iter_offsets(-2..1).collect_vec(),
            vec![-20.0, -10.0, 0.0],
        );

        assert_eq!(offsets.set_size(-2, 5.0), 10.0);
        assert_eq!(offsets.set_size(0, 100.0), 10.0);
        assert_eq!(offsets.set_size(2, 500.0), 10.0);
        assert_eq!(offsets.set_size(2, 1000.0), 500.0);

        assert_eq!(
            offsets.iter_offsets(-3..0).collect_vec(),
            vec![-25.0, -15.0, -10.0],
        );
        assert_eq!(
            offsets.iter_offsets(-2..1).collect_vec(),
            vec![-15.0, -10.0, 0.0],
        );
        assert_eq!(
            offsets.iter_offsets(-1..2).collect_vec(),
            vec![-10.0, 0.0, 100.0],
        );
        assert_eq!(
            offsets.iter_offsets(0..3).collect_vec(),
            vec![0.0, 100.0, 110.0],
        );
        assert_eq!(
            offsets.iter_offsets(1..4).collect_vec(),
            vec![100.0, 110.0, 1110.0],
        );
    }

    #[test]
    fn test_offsets_move() {
        let mut offsets = Offsets::new(10.0);
        for i in 0..10 {
            offsets.set_size(i, i as f64);
        }
        offsets.move_elem(3, 6);
        assert_eq!(offsets.get_size(2), 2.0);
        assert_eq!(offsets.get_size(3), 4.0);
        assert_eq!(offsets.get_size(4), 5.0);
        assert_eq!(offsets.get_size(5), 6.0);
        assert_eq!(offsets.get_size(6), 3.0);
        assert_eq!(offsets.get_size(7), 7.0);
        offsets.move_elem(6, 3);
        for i in 0..10 {
            assert_eq!(offsets.get_size(i), i as f64);
        }
    }

    #[test]
    fn test_find_offsets_default() {
        let offsets = Offsets::new(10.0);

        assert_eq!(offsets.find_offset(0.0), (0, 0.0));
        assert_eq!(offsets.find_offset(9.0), (0, 0.0));

        // 0 .. 10 .. 20 .^. 30
        assert_eq!(offsets.find_offset(25.0), (2, 20.0));

        assert_eq!(offsets.find_offset(-9.0), (-1, -10.0));

        // -30 .^. -20 .. -10 .. 0
        assert_eq!(offsets.find_offset(-25.0), (-3, -30.0));
    }

    #[test]
    fn test_find_offsets_changed() {
        let mut offsets = Offsets::new(10.0);
        offsets.set_size(0, 20.0);
        offsets.set_size(-1, 20.0);

        assert_eq!(offsets.find_offset(0.0), (0, 0.0));
        assert_eq!(offsets.find_offset(10.0), (0, 0.0));
        assert_eq!(offsets.find_offset(20.0), (1, 20.0));

        // 0 .. 20 .. 30 .^. 40
        assert_eq!(offsets.find_offset(25.0), (1, 20.0));
        assert_eq!(offsets.find_offset(35.0), (2, 30.0));

        assert_eq!(offsets.find_offset(-9.0), (-1, -20.0));

        // -40 .. -30 .. -20 .. 0
        assert_eq!(offsets.find_offset(-20.0), (-1, -20.0));
        assert_eq!(offsets.find_offset(-21.0), (-2, -30.0));

        // -40 .^. -30 .. -20 .. 0
        assert_eq!(offsets.find_offset(-35.0), (-3, -40.0));
    }

    #[test]
    fn test_iter_screen_offsets() {
        let offsets = Offsets::new(10.0);

        // 0 .. 10 .. 20 .^. 30
        let list: Vec<f64> = offsets
            .iter_screen_offsets(Range {
                start: 0.0,
                end: 21.0,
            })
            .collect();
        assert_eq!(list.first(), Some(&0.0));
        assert_eq!(list.last(), Some(&30.0));

        let list: Vec<f64> = offsets
            .iter_screen_offsets(Range {
                start: -100.0,
                end: 100.0,
            })
            .collect();
        assert_eq!(list.first(), Some(&-100.0));
        assert_eq!(list.last(), Some(&110.0));
    }
}
