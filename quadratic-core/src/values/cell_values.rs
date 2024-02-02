use crate::CellValue;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CellValues {
    pub columns: Vec<BTreeMap<u64, CellValue>>,
    pub w: u32,
    pub h: u32,
}

impl CellValues {
    pub fn new(w: u32, h: u32) -> Self {
        Self {
            columns: vec![BTreeMap::new(); w as usize],
            w,
            h,
        }
    }

    pub fn get(&self, x: u32, y: u32) -> Option<&CellValue> {
        assert!(x < self.w && y < self.h, "CellValues::get out of bounds");
        self.columns
            .get(x as usize)
            .and_then(|col| col.get(&(y as u64)))
    }

    pub fn set(&mut self, x: u32, y: u32, value: CellValue) {
        assert!(x < self.w && y < self.h, "CellValues::set out of bounds");
        self.columns[x as usize].insert(y as u64, value);
    }

    pub fn remove(&mut self, x: u32, y: u32) {
        assert!(x < self.w && y < self.h, "CellValues::remove out of bounds");
        self.columns[x as usize].remove(&(y as u64));
    }

    pub fn size(&self) -> u32 {
        self.w * self.h
    }

    /// Creates CellValues from a flat array of CellValue given a width and height
    pub fn from_flat_array(w: u32, h: u32, values: Vec<CellValue>) -> Self {
        assert!(
            w * h == values.len() as u32,
            "CellValues::flat_array size mismatch"
        );
        let mut columns = vec![BTreeMap::new(); w as usize];
        for (i, value) in values.into_iter().enumerate() {
            let x = (i as u32) % w;
            let y = (i as u32) / w;
            columns[x as usize].insert(y as u64, value);
        }
        Self { columns, w, h }
    }

    pub fn into_iter(&self) -> impl Iterator<Item = (u32, u32, &CellValue)> {
        self.columns.iter().enumerate().flat_map(|(x, col)| {
            col.iter()
                .map(move |(y, value)| (x as u32, *y as u32, value))
        })
    }
}

impl From<Vec<Vec<CellValue>>> for CellValues {
    fn from(values: Vec<Vec<CellValue>>) -> Self {
        let w = values.len() as u32;
        let h = values.iter().map(|col| col.len() as u32).max().unwrap_or(0);
        let mut columns = vec![BTreeMap::new(); w as usize];
        for (x, col) in values.into_iter().enumerate() {
            for (y, value) in col.into_iter().enumerate() {
                if value != CellValue::Blank {
                    columns[x].insert(y as u64, value);
                }
            }
        }
        Self { columns, w, h }
    }
}

/// Convert a 2D array of strings into a CellValues.
/// The first dimension is the x-axis, the second is the y-axis.
/// Therefore, [[1, 2, 3], [4, 5, 6]] becomes:
/// 1 2 3
/// 4 5 6
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
        if value != CellValue::Blank {
            c.set(0, 0, value);
        }
        c
    }
}

#[cfg(test)]
mod test {
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
    fn from_cell_value() {
        let cell_values = CellValues::from(vec![vec![CellValue::from("a"), CellValue::from("b")]]);
        assert_eq!(cell_values.w, 1);
        assert_eq!(cell_values.h, 2);
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
        assert_eq!(cell_values.get(0, 1), Some(&CellValue::from("b")));
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
}
