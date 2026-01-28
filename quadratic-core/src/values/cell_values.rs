//! CellValues is a 2D array of CellValue used for Operation::SetCellValues.
//! The width and height may grow as needed.

use crate::{Array, ArraySize, CellValue, Pos, Rect};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Sparsely-populated rectangle of [`CellValue`]s.
#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CellValues {
    pub(crate) columns: Vec<BTreeMap<u64, CellValue>>,
    pub(crate) w: u32,
    pub(crate) h: u32,
}

impl CellValues {
    pub fn new(w: u32, h: u32) -> Self {
        Self {
            columns: vec![BTreeMap::new(); w as usize],
            w,
            h,
        }
    }

    pub fn new_blank(w: u32, h: u32) -> Self {
        let mut columns = Vec::with_capacity(w as usize);
        let mut column = BTreeMap::new();
        for y in 0..h {
            column.insert(y as u64, CellValue::Blank);
        }
        for _ in 0..w {
            columns.push(column.clone());
        }
        Self { columns, w, h }
    }

    pub fn get_except_blank(&self, x: u32, y: u32) -> Option<&CellValue> {
        self.columns
            .get(x as usize)
            .and_then(|col| col.get(&(y as u64)))
            .and_then(|value| {
                if value == &CellValue::Blank {
                    None
                } else {
                    Some(value)
                }
            })
    }

    pub fn get(&self, x: u32, y: u32) -> Option<&CellValue> {
        self.columns
            .get(x as usize)
            .and_then(|col| col.get(&(y as u64)))
    }

    pub fn get_mut(&mut self, x: u32, y: u32) -> anyhow::Result<&mut CellValue> {
        let column = self
            .columns
            .get_mut(x as usize)
            .ok_or_else(|| anyhow::anyhow!("No column found at {x}"))?;

        column
            .get_mut(&(y as u64))
            .ok_or_else(|| anyhow::anyhow!("No value found at ({x}, {y})"))
    }

    pub fn get_rect(&mut self, rect: Rect) -> Vec<Vec<Option<CellValue>>> {
        // Compute width and height using checked arithmetic to prevent overflow
        // Calculate width/height manually to avoid potential overflow
        let width_i64 = match rect.max.x.checked_sub(rect.min.x) {
            Some(diff) => match diff.checked_add(1) {
                Some(w) => w,
                None => return vec![], // Overflow in width calculation
            },
            None => return vec![], // Overflow in width calculation
        };

        let height_i64 = match rect.max.y.checked_sub(rect.min.y) {
            Some(diff) => match diff.checked_add(1) {
                Some(h) => h,
                None => return vec![], // Overflow in height calculation
            },
            None => return vec![], // Overflow in height calculation
        };

        // Check for negative or zero dimensions
        if width_i64 <= 0 || height_i64 <= 0 {
            return vec![];
        }

        // Convert to usize with overflow checking - use a reasonable maximum to prevent capacity overflow
        const MAX_DIMENSION: i64 = 1_000_000; // Reasonable maximum to prevent overflow
        if width_i64 > MAX_DIMENSION || height_i64 > MAX_DIMENSION {
            return vec![];
        }

        let width_usize = match usize::try_from(width_i64) {
            Ok(w) => w,
            _ => return vec![],
        };

        let height_usize = match usize::try_from(height_i64) {
            Ok(h) => h,
            _ => return vec![],
        };

        // Check if total capacity would overflow
        if width_usize.checked_mul(height_usize).is_none() {
            return vec![];
        }

        let mut values = vec![vec![None; height_usize]; width_usize];

        // Clamp the rect to the bounds of this CellValues structure (0..w, 0..h)
        let bounds_rect = Rect::from_numbers(0, 0, self.w as i64, self.h as i64);
        let clamped_rect = match rect.intersection(&bounds_rect) {
            Some(intersected) => intersected,
            None => {
                // Rect is completely outside bounds, return all None values
                return values;
            }
        };

        // Only populate cells that are within bounds
        for (x_index, x) in rect.x_range().enumerate() {
            for (y_index, y) in rect.y_range().enumerate() {
                // Check if this coordinate is within the clamped (intersected) rect
                if clamped_rect.contains(Pos { x, y })
                    && let (Ok(new_x), Ok(new_y)) = (u32::try_from(x), u32::try_from(y))
                    && new_x < self.w
                    && new_y < self.h
                {
                    values[x_index][y_index] = self.remove(new_x, new_y);
                }
            }
        }
        values
    }

    pub fn get_row(&self, row: u32) -> Result<Vec<CellValue>, anyhow::Error> {
        if row >= self.h {
            anyhow::bail!("Row out of bounds: row={row}, h={}", self.h);
        }
        let mut values = Vec::with_capacity(self.w as usize);
        for x in 0..self.w {
            values.push(self.get(x, row).unwrap_or(&CellValue::Blank).clone());
        }
        Ok(values)
    }

    pub fn set(&mut self, x: u32, y: u32, value: CellValue) {
        if y >= self.h {
            self.h = y + 1;
        }

        // w can grow if too small
        if x >= self.w {
            for _ in self.w..=x {
                self.columns.push(BTreeMap::new());
                self.w += 1;
            }
        }
        self.columns[x as usize].insert(y as u64, value);
    }

    pub fn remove(&mut self, x: u32, y: u32) -> Option<CellValue> {
        self.columns
            .get_mut(x as usize)
            .and_then(|col| col.remove(&(y as u64)))
    }

    pub fn size(&self) -> u32 {
        self.w * self.h
    }

    pub fn is_empty(&self) -> bool {
        self.size() == 0
    }

    /// Creates CellValues from a flat array of CellValue given a width and height
    pub fn from_flat_array(w: u32, h: u32, values: Vec<CellValue>) -> Self {
        let mut columns = vec![BTreeMap::new(); w as usize];
        for (i, value) in values.into_iter().enumerate() {
            let x = (i as u32) % w;
            let y = (i as u32) / w;
            columns
                .get_mut(x as usize)
                .and_then(|col| col.insert(y as u64, value));
        }
        Self { columns, w, h }
    }

    pub fn into_iter(&self) -> impl Iterator<Item = (u32, u32, &CellValue)> {
        self.columns.iter().enumerate().flat_map(|(x, col)| {
            col.iter()
                .map(move |(y, value)| (x as u32, *y as u32, value))
        })
    }

    pub fn into_owned_iter(self) -> impl Iterator<Item = (u32, u32, CellValue)> {
        self.columns.into_iter().enumerate().flat_map(|(x, col)| {
            col.into_iter()
                .map(move |(y, value)| (x as u32, y as u32, value))
        })
    }

    pub fn into_owned_vec(self) -> Vec<Vec<CellValue>> {
        let mut vec = vec![vec![CellValue::Blank; self.w as usize]; self.h as usize];
        for (x, col) in self.columns.into_iter().enumerate() {
            for (y, value) in col.into_iter() {
                vec[y as usize][x] = value;
            }
        }
        vec
    }
}

/// Converts a 2D array of CellValue into CellValues
/// The first dimension is the y-axis, the second is the x-axis.
/// Therefore, [[1, 2, 3], [4, 5, 6]] becomes:
/// 1 4
/// 2 5
/// 3 6
impl From<Vec<Vec<CellValue>>> for CellValues {
    fn from(values: Vec<Vec<CellValue>>) -> Self {
        let w = values.iter().map(|col| col.len() as u32).max().unwrap_or(0);
        let h = values.len() as u32;
        let mut columns = vec![BTreeMap::new(); w as usize];
        for (y, col) in values.into_iter().enumerate() {
            for (x, value) in col.into_iter().enumerate() {
                columns[x].insert(y as u64, value);
            }
        }
        Self { columns, w, h }
    }
}

/// Converts a sparse 2D array of Vec<Vec<Option<CellValue>>> into CellValues
/// The first dimension is the x-axis, the second is the y-axis.
/// This is a different format the the `Vec<Vec<CellValue>>` impl above.
impl From<Vec<Vec<Option<CellValue>>>> for CellValues {
    fn from(values: Vec<Vec<Option<CellValue>>>) -> Self {
        if values.is_empty() || values[0].is_empty() {
            return CellValues::new(0, 0);
        }

        let w = values.len() as u32;
        let h = values[0].len() as u32;
        let mut cell_values = CellValues::new(w, h);

        for (x, col) in values.into_iter().enumerate() {
            for (y, value) in col.into_iter().enumerate() {
                if let Some(value) = value {
                    cell_values.set(x as u32, y as u32, value);
                }
            }
        }

        cell_values
    }
}

/// Convert a 2D array of strings into a CellValues.
/// The first dimension is the x-axis, the second is the y-axis.
/// Therefore, [[1, 2, 3], [4, 5, 6]] becomes:
/// 1 4
/// 2 5
/// 3 6
impl From<Vec<Vec<&str>>> for CellValues {
    fn from(values: Vec<Vec<&str>>) -> Self {
        let w = values.len() as u32;
        let h = values.iter().map(|col| col.len() as u32).max().unwrap_or(0);
        let mut columns = vec![BTreeMap::new(); w as usize];
        for (x, col) in values.into_iter().enumerate() {
            for (y, value) in col.into_iter().enumerate() {
                if !value.is_empty() {
                    columns[x].insert(y as u64, CellValue::from(value));
                }
            }
        }
        Self { columns, w, h }
    }
}

impl From<CellValue> for CellValues {
    fn from(value: CellValue) -> Self {
        let mut c = Self::new(1, 1);
        c.set(0, 0, value);
        c
    }
}

impl From<Array> for CellValues {
    fn from(array: Array) -> Self {
        let ArraySize { w, h } = array.size();
        let cell_values_vec = array.into_cell_values_vec().into_vec();

        CellValues::from_flat_array(w.get(), h.get(), cell_values_vec)
    }
}

#[cfg(test)]
mod test {

    use crate::wasm_bindings::js::clear_js_calls;

    use super::*;

    #[test]
    fn new() {
        let cell_values = CellValues::new(2, 3);
        assert_eq!(cell_values.w, 2);
        assert_eq!(cell_values.h, 3);
        assert_eq!(cell_values.columns.len(), 2);
        assert_eq!(cell_values.columns[0].len(), 0);
        assert_eq!(cell_values.columns[1].len(), 0);
    }

    #[test]
    fn new_blank() {
        let cell_values = CellValues::new_blank(2, 3);
        assert_eq!(cell_values.w, 2);
        assert_eq!(cell_values.h, 3);
        assert_eq!(cell_values.columns.len(), 2);
        assert_eq!(cell_values.columns[0].len(), 3);
        assert_eq!(cell_values.columns[1].len(), 3);
        assert_eq!(cell_values.columns[0].get(&0), Some(&CellValue::Blank));
        assert_eq!(cell_values.columns[1].get(&0), Some(&CellValue::Blank));
        assert_eq!(cell_values.columns[0].get(&1), Some(&CellValue::Blank));
        assert_eq!(cell_values.columns[1].get(&1), Some(&CellValue::Blank));
        assert_eq!(cell_values.columns[0].get(&2), Some(&CellValue::Blank));
        assert_eq!(cell_values.columns[1].get(&2), Some(&CellValue::Blank));
    }

    #[test]
    fn get_set_remove() {
        let mut cell_values = CellValues::new(2, 3);
        cell_values.set(0, 0, CellValue::from("a"));
        cell_values.set(1, 2, CellValue::from("b"));
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
        assert_eq!(cell_values.get(1, 2), Some(&CellValue::from("b")));
        assert_eq!(cell_values.get(1, 0), None);
        cell_values.remove(0, 0);
        assert_eq!(cell_values.get(0, 0), None);
    }

    #[test]
    fn remove_out_of_bounds() {
        let mut cell_values = CellValues::new(2, 3);
        // Removing from out-of-bounds x should return None, not panic
        assert_eq!(cell_values.remove(5, 0), None);
        assert_eq!(cell_values.remove(2, 0), None);
        // Removing from valid x but out-of-bounds y should return None
        assert_eq!(cell_values.remove(0, 10), None);
    }

    #[test]
    fn get_except_blank() {
        let mut cell_values = CellValues::new(2, 3);
        cell_values.set(0, 0, CellValue::from("a"));
        cell_values.set(1, 2, CellValue::Blank);
        assert_eq!(
            cell_values.get_except_blank(0, 0),
            Some(&CellValue::from("a"))
        );
        assert_eq!(cell_values.get_except_blank(1, 2), None);
    }

    #[test]
    fn from_str() {
        let cell_values = CellValues::from(vec![vec!["a", "b"], vec!["c", "d"]]);
        assert_eq!(cell_values.w, 2);
        assert_eq!(cell_values.h, 2);
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
        assert_eq!(cell_values.get(1, 1), Some(&CellValue::from("d")));
    }

    #[test]
    fn size() {
        let cell_values = CellValues::new(2, 3);
        assert_eq!(cell_values.size(), 6);
    }

    #[test]
    fn from_cell_value_single() {
        let cell_values = CellValues::from(CellValue::from("a"));
        assert_eq!(cell_values.w, 1);
        assert_eq!(cell_values.h, 1);
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
    }

    #[test]
    fn from_flat_array() {
        let cell_values = CellValues::from_flat_array(2, 3, vec![CellValue::from("a"); 6]);
        assert_eq!(cell_values.w, 2);
        assert_eq!(cell_values.h, 3);
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
        assert_eq!(cell_values.get(1, 2), Some(&CellValue::from("a")));
    }

    #[test]
    fn into_iter() {
        let cell_values = CellValues::from(vec![vec!["a", "b"], vec!["c", "d"]]);
        let mut iter = cell_values.into_iter();
        assert_eq!(iter.next(), Some((0, 0, &CellValue::from("a"))));
        assert_eq!(iter.next(), Some((0, 1, &CellValue::from("b"))));
        assert_eq!(iter.next(), Some((1, 0, &CellValue::from("c"))));
        assert_eq!(iter.next(), Some((1, 1, &CellValue::from("d"))));
        assert_eq!(iter.next(), None);
    }

    #[test]
    fn cell_values_serialize_large() {
        let w = 100;
        let h = 10000;
        let mut cell_values = CellValues::new(w, h);
        for x in 0..w {
            for y in 0..h {
                cell_values.set(x, y, CellValue::from("a"));
            }
        }
        let json = serde_json::to_string(&cell_values).unwrap();
        assert!(json.len() > (w * h * 3) as usize);
        clear_js_calls();
    }

    #[test]
    fn cell_values_w_grows() {
        let mut cell_values = CellValues::new(1, 1);
        cell_values.set(1, 0, CellValue::from("a"));
        assert_eq!(cell_values.w, 2);
        assert_eq!(cell_values.columns.len(), 2);
        assert_eq!(cell_values.h, 1);
        assert_eq!(cell_values.get(1, 0), Some(&CellValue::from("a")));
    }

    #[test]
    fn cell_values_from_vec_of_vec_of_option() {
        let mut cell_values = vec![vec![None; 1]; 4];
        cell_values[0][0] = Some(CellValue::from("a"));
        cell_values[1][0] = Some(CellValue::from("b"));
        cell_values[3][0] = Some(CellValue::from("c"));
        let cell_values = CellValues::from(cell_values);

        assert_eq!(cell_values.w, 4);
        assert_eq!(cell_values.h, 1);
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
        assert_eq!(cell_values.get(1, 0), Some(&CellValue::from("b")));
        assert_eq!(cell_values.get(3, 0), Some(&CellValue::from("c")));
    }

    #[test]
    fn cell_values_from_empty_vec_of_vec_of_option() {
        // Test that empty vectors don't panic
        let empty: Vec<Vec<Option<CellValue>>> = vec![];
        let cell_values = CellValues::from(empty);
        assert_eq!(cell_values.w, 0);
        assert_eq!(cell_values.h, 0);

        // Test that vectors with empty inner vectors don't panic
        let empty_inner: Vec<Vec<Option<CellValue>>> = vec![vec![]];
        let cell_values = CellValues::from(empty_inner);
        assert_eq!(cell_values.w, 0);
        assert_eq!(cell_values.h, 0);
    }

    #[test]
    fn test_get_row() {
        let cell_values = CellValues::from(vec![
            vec!["a", "b", "c"], // column 0
            vec!["d", "e"],      // column 1 (shorter)
            vec!["f", "g", "h"], // column 2
        ]);

        // Should have w=3, h=3
        assert_eq!(cell_values.w, 3);
        assert_eq!(cell_values.h, 3);

        // Test row 0: ["a", "d", "f"]
        let row0 = cell_values.get_row(0).unwrap();
        assert_eq!(
            row0,
            vec![
                CellValue::from("a"),
                CellValue::from("d"),
                CellValue::from("f")
            ]
        );

        // Test row 1: ["b", "e", "g"]
        let row1 = cell_values.get_row(1).unwrap();
        assert_eq!(
            row1,
            vec![
                CellValue::from("b"),
                CellValue::from("e"),
                CellValue::from("g"),
            ]
        );

        // Test row 2: ["c", Blank, "h"]
        let row2 = cell_values.get_row(2).unwrap();
        assert_eq!(
            row2,
            vec![CellValue::from("c"), CellValue::Blank, CellValue::from("h"),]
        );
    }

    #[test]
    fn get_rect_out_of_bounds() {
        let mut cell_values = CellValues::new(2, 3);
        cell_values.set(0, 0, CellValue::from("a"));
        cell_values.set(1, 1, CellValue::from("b"));

        // Test get_rect with rect that extends beyond the CellValues bounds
        // This should not panic, but return None for out-of-bounds cells
        let rect = Rect::from_numbers(0, 0, 5, 5); // Extends beyond w=2, h=3
        let result = cell_values.get_rect(rect);

        // Should have 5x5 = 25 cells
        assert_eq!(result.len(), 5);
        assert_eq!(result[0].len(), 5);

        // First cell should be Some("a")
        assert_eq!(result[0][0], Some(CellValue::from("a")));
        // Second row, second column should be Some("b")
        assert_eq!(result[1][1], Some(CellValue::from("b")));
        // Out-of-bounds cells should be None
        assert_eq!(result[2][0], None);
        assert_eq!(result[0][3], None);
        assert_eq!(result[4][4], None);
    }
}
