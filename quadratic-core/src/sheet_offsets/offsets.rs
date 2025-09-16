//! This contains one direction of offsets (eg, the column widths or the row
//! heights). The SheetOffsets is made up of two of these Offsets.
//!
//! Right now this is optimized for sheets with less offset entries and
//! smaller offsets. There was a TS version that kept cached values for larger
//! offsets. As we move to larger sheets, we may have to bring that
//! back, as this can get slow at very large indices.

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap};
use std::ops::Range;

#[cfg(feature = "js")]
use wasm_bindgen::prelude::wasm_bindgen;

use itertools::Itertools;

// todo: delete_many and insert_many would be helpful

/// Data structure that tracks column widths or row heights in pixel units,
/// optimized for converting between column/row indices and pixel units.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
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
            sizes: iter
                .into_iter()
                .filter(|(index, size)| *index > 0 && *size != default)
                .collect(),
        }
    }

    /// Moves the column/row from `from_index` to `to_index`, shifting the ones
    /// between.
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
    pub fn find_offset(&self, pixel: f64) -> (i64, f64) {
        let mut current_sum = 0.0;
        let mut current_index = 1i64;

        // If we have no custom sizes then it's all default sizes
        if self.sizes.is_empty() {
            let index = (pixel / self.default).floor() as i64;
            let position = index as f64 * self.default;
            return (index + 1, position);
        }

        // Iterate through custom sizes only to avoid checking every default value
        for (&custom_index, &custom_size) in &self.sizes {
            // Calculate how many default-sized elements are between current_index and custom_index
            if custom_index > current_index {
                let default_count = custom_index - current_index;
                let default_total = default_count as f64 * self.default;

                // Check if pixel falls within the default range
                if current_sum + default_total > pixel {
                    // Pixel is in the default range
                    let remaining = pixel - current_sum;
                    let offset_in_defaults = (remaining / self.default).floor() as i64;
                    return (
                        current_index + offset_in_defaults,
                        current_sum + offset_in_defaults as f64 * self.default,
                    );
                }

                current_sum += default_total;
                current_index = custom_index;
            }

            // Check if pixel falls within this custom size
            if current_sum + custom_size > pixel {
                return (current_index, current_sum);
            }

            current_sum += custom_size;
            current_index += 1;
        }

        // Pixel is beyond all custom sizes, continue with defaults
        let remaining = pixel - current_sum;
        let offset_in_defaults = (remaining / self.default).floor() as i64;
        (
            current_index + offset_in_defaults,
            current_sum + offset_in_defaults as f64 * self.default,
        )
    }

    /// Iterates over the sizes of all columns/rows.
    pub fn iter_sizes(&self) -> impl '_ + Iterator<Item = (i64, f64)> {
        self.sizes.iter().map(|(&k, &v)| (k, v))
    }

    /// Iterates over the sizes of all columns/rows - owned.
    pub fn into_iter_sizes(self) -> impl Iterator<Item = (i64, f64)> {
        self.sizes
            .into_iter()
            .filter(move |(index, size)| *index > 0 && *size != self.default)
    }

    /// Inserts an offset at the specified index and increments all later
    /// indices. If source_width is provided, it sets the inserted offset at
    /// that value; otherwise it sets it at the default value.
    ///
    /// Returns a vector of changes made to the offsets structure, where each
    /// change is represented as a tuple (index, new_size).
    pub fn insert(&mut self, index: i64, source_width: Option<f64>) -> Vec<(i64, f64)> {
        let mut sizes = BTreeMap::new();
        let mut keys = self.sizes.keys().collect_vec();

        // ensure the new column is included in the list
        if !keys.contains(&&index) {
            keys.push(&index);
        }
        keys.sort();

        // iterate over the keys and push set sizes one to the right if >= than
        // the index
        for k in keys {
            if let Some(size) = self.sizes.get(k) {
                if *k >= index {
                    sizes.insert(*k + 1, *size);

                    // if the key is the index, set the size
                    if *k == index
                        && let Some(source_width) = source_width
                    {
                        sizes.insert(*k, source_width);
                    }
                } else {
                    sizes.insert(*k, *size);
                }
            } else if *k == index {
                // if the key is on an unset index, then set the size
                if let Some(source_width) = source_width {
                    sizes.insert(*k, source_width);
                }
            }
        }

        // compare sizes to self.sizes to collect changes
        let mut changed = Vec::new();
        if let (Some(min), Some(max)) = (
            self.sizes.keys().min().min(sizes.keys().min()),
            self.sizes.keys().max().max(sizes.keys().max()),
        ) {
            for k in *min..=*max {
                let current = sizes.get(&k);
                let old = self.sizes.get(&k);
                if current != old {
                    changed.push((k, *current.unwrap_or(&self.default)));
                }
            }
        }

        self.sizes = sizes;
        changed
    }

    /// Removes an offset at the specified index and decrements all later
    /// indices.
    ///
    /// Returns a tuple of (Vec<(i64, f64)>, Option<f64>) where the Vec contains
    /// the changes made to the offsets structure, and the Option<f64> is the
    /// old size of the removed offset, if it existed.
    pub fn delete(&mut self, index: i64) -> (Vec<(i64, f64)>, Option<f64>) {
        let mut changed = HashMap::new();
        let mut old: Option<f64> = None;
        let keys = self.sizes.keys().sorted_unstable();

        let mut sizes = BTreeMap::new();

        for k in keys {
            if let Some(size) = self.sizes.get(k) {
                match k.cmp(&index) {
                    Ordering::Equal => {
                        old = Some(*size);
                        changed.insert(*k, self.default);
                    }
                    Ordering::Greater => {
                        changed.insert(*k - 1, *size);
                        changed.insert(*k, self.default);
                        sizes.insert(*k - 1, *size);
                        sizes.remove(k);
                    }
                    Ordering::Less => {
                        sizes.insert(*k, *size);
                    }
                }
            }
        }
        self.sizes = sizes;
        (
            changed.into_iter().sorted_by_key(|(k, _)| *k).collect(),
            old,
        )
    }

    /// Changes the default size
    pub fn set_default(&mut self, size: f64) -> f64 {
        let current = self.default;
        self.default = size;
        current
    }

    /// Clears all sizes and resets to the default.
    pub fn clear(&mut self) -> Vec<(i64, f64)> {
        let changed: Vec<(i64, f64)> = self
            .sizes
            .iter()
            .map(|(&index, &size)| (index, size))
            .collect();
        self.sizes.clear();
        changed
    }

    /// Retains only positive non-default sizes.
    #[cfg(test)]
    pub fn retain_positive_non_default(&mut self) {
        self.sizes
            .retain(|&index, size| index > 0 && size != &self.default);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_offsets_structure() {
        let mut offsets = Offsets::new(10.0);
        assert_eq!(offsets.get_size(1), 10.0);
        assert_eq!(
            offsets.iter_offsets(1..4).collect_vec(),
            vec![0.0, 10.0, 20.0],
        );
        assert_eq!(offsets.iter_offsets(2..4).collect_vec(), vec![10.0, 20.0]);

        assert_eq!(offsets.set_size(1, 100.0), 10.0);
        assert_eq!(offsets.set_size(3, 500.0), 10.0);
        assert_eq!(offsets.set_size(3, 1000.0), 500.0);

        assert_eq!(offsets.iter_offsets(1..3).collect_vec(), vec![0.0, 100.0],);
        assert_eq!(
            offsets.iter_offsets(1..5).collect_vec(),
            vec![0.0, 100.0, 110.0, 1110.0],
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

        assert_eq!(offsets.find_offset(0.0), (1, 0.0));
        assert_eq!(offsets.find_offset(9.0), (1, 0.0));
        assert_eq!(offsets.find_offset(10.0), (2, 10.0));
        assert_eq!(offsets.find_offset(11.0), (2, 10.0));
        assert_eq!(offsets.find_offset(25.0), (3, 20.0));
    }

    #[test]
    fn test_insert() {
        let mut offsets = Offsets::new(10.0);

        assert_eq!(offsets.insert(1, None), vec![]);

        offsets.set_size(1, 20.0);
        offsets.set_size(2, 30.0);
        offsets.set_size(3, 40.0);

        assert_eq!(
            offsets.insert(2, Some(5.0)),
            vec![(2, 5.0), (3, 30.0), (4, 40.0)]
        );

        assert_eq!(offsets.get_size(1), 20.0);
        assert_eq!(offsets.get_size(2), 5.0);
        assert_eq!(offsets.get_size(3), 30.0);
        assert_eq!(offsets.get_size(4), 40.0);
    }

    #[test]
    fn test_insert_defaults() {
        let mut offsets = Offsets::new(10.0);
        offsets.set_size(1, 20.0);
        offsets.set_size(10, 30.0);

        assert_eq!(
            offsets.insert(2, Some(20.0)),
            vec![(2, 20.0), (10, 10.0), (11, 30.0)]
        );

        assert_eq!(offsets.get_size(1), 20.0);
        assert_eq!(offsets.get_size(2), 20.0);
        assert_eq!(offsets.get_size(3), 10.0);
        assert_eq!(offsets.get_size(10), 10.0);
        assert_eq!(offsets.get_size(11), 30.0);
    }

    #[test]
    fn test_delete() {
        let mut offsets = Offsets::new(10.0);

        assert_eq!(offsets.delete(1), (vec![], None));

        offsets.set_size(1, 20.0);
        offsets.set_size(2, 30.0);
        offsets.set_size(3, 40.0);

        let deleted = offsets.delete(2);

        assert_eq!(deleted, (vec![(2, 40.0), (3, offsets.default)], Some(30.0)));
        assert_eq!(offsets.get_size(1), 20.0);
        assert_eq!(offsets.get_size(2), 40.0);
        assert_eq!(offsets.get_size(3), offsets.default);
    }

    #[test]
    fn test_find_offsets_custom() {
        let mut offsets = Offsets::new(10.0);
        offsets.set_size(1, 20.0);
        offsets.set_size(3, 30.0);

        // 1/0-20 2/20-30 3/30-60 4/60-70 ...

        assert_eq!(offsets.find_offset(0.0), (1, 0.0));
        assert_eq!(offsets.find_offset(15.0), (1, 0.0));
        assert_eq!(offsets.find_offset(20.0), (2, 20.0));
        assert_eq!(offsets.find_offset(25.0), (2, 20.0));
        assert_eq!(offsets.find_offset(30.0), (3, 30.0));
        assert_eq!(offsets.find_offset(55.0), (3, 30.0));
        assert_eq!(offsets.find_offset(62.0), (4, 60.0));
    }

    #[test]
    fn test_reset() {
        let mut offsets = Offsets::new(10.0);
        offsets.set_size(1, 20.0);
        offsets.set_size(2, 30.0);

        assert_eq!(offsets.reset(1), 20.0);
        assert_eq!(offsets.get_size(1), 10.0);
        assert_eq!(offsets.reset(3), 10.0); // Resetting non-existent entry
    }

    #[test]
    fn test_from_iter() {
        let items = vec![(1, 20.0), (3, 30.0), (5, 50.0)];
        let offsets = Offsets::from_iter(10.0, items);

        assert_eq!(offsets.get_size(1), 20.0);
        assert_eq!(offsets.get_size(2), 10.0);
        assert_eq!(offsets.get_size(3), 30.0);
        assert_eq!(offsets.get_size(4), 10.0);
        assert_eq!(offsets.get_size(5), 50.0);
    }

    #[test]
    fn test_set_default() {
        let mut offsets = Offsets::new(10.0);

        // Verify initial default value
        assert_eq!(offsets.get_size(1), 10.0);

        // Change default and verify return value
        assert_eq!(offsets.set_default(20.0), 10.0);

        // Verify new default is applied to existing entries
        assert_eq!(offsets.get_size(1), 20.0);

        // Verify new default is applied to new entries
        assert_eq!(offsets.get_size(100), 20.0);

        // Change default again and verify
        assert_eq!(offsets.set_default(30.0), 20.0);
        assert_eq!(offsets.get_size(1), 30.0);
    }

    #[test]
    fn test_clear() {
        let mut offsets = Offsets::new(10.0);

        // Set some custom sizes
        offsets.set_size(1, 20.0);
        offsets.set_size(2, 30.0);
        offsets.set_size(3, 40.0);

        // Verify sizes are set correctly
        assert_eq!(offsets.get_size(1), 20.0);
        assert_eq!(offsets.get_size(2), 30.0);
        assert_eq!(offsets.get_size(3), 40.0);

        // Clear all sizes
        let changes = offsets.clear();

        // Verify changes returned
        assert_eq!(changes, vec![(1, 20.0), (2, 30.0), (3, 40.0)]);

        // Verify all sizes are reset to default
        assert_eq!(offsets.get_size(1), 10.0);
        assert_eq!(offsets.get_size(2), 10.0);
        assert_eq!(offsets.get_size(3), 10.0);

        // Verify new entries also use default
        assert_eq!(offsets.get_size(100), 10.0);
    }

    #[test]
    fn test_find_offset_large_pixel_ranges() {
        // Test find_offset with pixel ranges > 300 million
        let mut offsets = Offsets::new(10.0);

        // Test with default sizes only for large pixel values
        let pixel_300m = 300_000_000.0;
        let (index, position) = offsets.find_offset(pixel_300m);
        let expected_index = (pixel_300m / 10.0).floor() as i64 + 1;
        let expected_position = (expected_index - 1) as f64 * 10.0;
        assert_eq!(index, expected_index);
        assert_eq!(position, expected_position);

        // Test with pixel value > 300m
        let pixel_500m = 500_000_000.0;
        let (index, position) = offsets.find_offset(pixel_500m);
        let expected_index = (pixel_500m / 10.0).floor() as i64 + 1;
        let expected_position = (expected_index - 1) as f64 * 10.0;
        assert_eq!(index, expected_index);
        assert_eq!(position, expected_position);

        // Test with custom sizes and large pixel values
        offsets.set_size(1, 20.0);
        offsets.set_size(1000, 50.0);

        // For pixel beyond custom sizes, should continue with defaults
        let pixel_1b = 1_000_000_000.0;
        let (index, position) = offsets.find_offset(pixel_1b);

        // Calculate expected values considering custom sizes
        let custom_contribution = 20.0 - 10.0 + 50.0 - 10.0; // difference from default
        let remaining_pixels = pixel_1b - custom_contribution - 1000.0 * 10.0; // subtract all pixels up to index 1001
        let additional_defaults = (remaining_pixels / 10.0).floor() as i64;
        let expected_index = 1001 + additional_defaults;
        let expected_position =
            custom_contribution + 1000.0 * 10.0 + additional_defaults as f64 * 10.0;

        assert_eq!(index, expected_index);
        assert_eq!(position, expected_position);
    }
}
