use std::collections::BTreeMap;

use crate::CellValue;

#[derive(Debug, PartialEq)]
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
                columns[x].insert(y as u64, CellValue::from(value));
            }
        }
        Self { columns, w, h }
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
    fn from() {
        let cell_values = CellValues::from(vec![vec!["a", "b"], vec!["c", "d"]]);
        assert_eq!(cell_values.w, 2);
        assert_eq!(cell_values.h, 2);
        assert_eq!(cell_values.get(0, 0), Some(&CellValue::from("a")));
        assert_eq!(cell_values.get(1, 1), Some(&CellValue::from("d")));
    }
}
