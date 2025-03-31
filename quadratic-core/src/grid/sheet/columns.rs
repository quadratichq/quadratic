use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, btree_map};

use crate::{
    Array, CellValue, CopyFormats, Pos, Rect,
    grid::{Column, Contiguous2D},
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SheetColumns {
    #[serde(with = "crate::util::btreemap_serde")]
    columns: BTreeMap<i64, Column>,

    has_value: Contiguous2D<Option<bool>>,
}

impl Default for SheetColumns {
    fn default() -> Self {
        Self::new()
    }
}

impl IntoIterator for SheetColumns {
    type Item = (i64, Column);
    type IntoIter = btree_map::IntoIter<i64, Column>;

    fn into_iter(self) -> Self::IntoIter {
        self.columns.into_iter()
    }
}

impl SheetColumns {
    pub fn new() -> Self {
        Self {
            columns: BTreeMap::new(),
            has_value: Contiguous2D::new(),
        }
    }

    pub fn from(columns: BTreeMap<i64, Column>, has_value: Contiguous2D<Option<bool>>) -> Self {
        Self { columns, has_value }
    }

    pub fn iter(&self) -> btree_map::Iter<'_, i64, Column> {
        self.columns.iter()
    }

    pub fn is_empty(&self) -> bool {
        self.columns.is_empty()
    }

    pub fn len(&self) -> usize {
        self.columns.len()
    }

    pub fn get_column(&self, column: i64) -> Option<&Column> {
        self.columns.get(&column)
    }

    pub fn get_value(&self, pos: &Pos) -> Option<&CellValue> {
        self.columns.get(&pos.x)?.values.get(&pos.y)
    }

    pub fn get_value_mut(&mut self, pos: &Pos) -> Option<&mut CellValue> {
        self.columns.get_mut(&pos.x)?.values.get_mut(&pos.y)
    }

    pub fn get_nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<bool>)> {
        self.has_value.nondefault_rects_in_rect(rect)
    }

    pub fn set_value(&mut self, pos: &Pos, value: impl Into<CellValue>) -> Option<CellValue> {
        let value = value.into();
        let is_empty = value.is_blank_or_empty_string();
        let value: Option<CellValue> = if is_empty { None } else { Some(value) };

        // if there's no value and the column doesn't exist, then nothing more needs to be done
        if value.is_none() && !self.columns.contains_key(&pos.x) {
            return None;
        }

        let column = match self.columns.entry(pos.x) {
            btree_map::Entry::Vacant(e) => {
                let column = e.insert(Column::new(pos.x));
                column
            }
            btree_map::Entry::Occupied(e) => {
                let column = e.into_mut();
                column
            }
        };

        if let Some(value) = value {
            self.has_value.set(*pos, Some(true));
            column.values.insert(pos.y, value)
        } else {
            self.has_value.set(*pos, None);
            column.values.remove(&pos.y)
        }
    }

    pub fn delete_values(&mut self, rect: Rect) -> Array {
        self.has_value.set_rect(
            rect.min.x,
            rect.min.y,
            Some(rect.max.x),
            Some(rect.max.y),
            None,
        );

        let mut old_cell_values_array = Array::new_empty(rect.size());
        for x in rect.x_range() {
            let Some(column) = self.columns.get_mut(&x) else {
                continue;
            };
            let filtered = column
                .values
                .range(rect.y_range())
                .map(|(y, _)| *y)
                .collect::<Vec<_>>();
            let removed = filtered
                .iter()
                .map(|y| (*y, column.values.remove(y)))
                .collect::<Vec<_>>();
            for (y, value) in removed {
                let array_x = (x - rect.min.x) as u32;
                let array_y = (y - rect.min.y) as u32;
                if let Some(cell_value) = value {
                    old_cell_values_array
                        .set(array_x, array_y, cell_value)
                        .expect("error inserting value into array of old cell values");
                }
            }
        }
        old_cell_values_array
    }

    pub fn clear(&mut self) {
        self.has_value.set_rect(1, 1, None, None, None);
        self.columns.clear();
    }

    pub fn finite_bounds(&self) -> Option<Rect> {
        self.has_value.finite_bounds()
    }

    pub fn insert_column(&mut self, column: i64) {
        self.has_value.insert_column(column, CopyFormats::None);

        // update the indices of all columns impacted by the insertion
        let mut columns_to_update = Vec::new();
        for col in self.columns.keys() {
            if *col >= column {
                columns_to_update.push(*col);
            }
        }
        columns_to_update.sort_by(|a, b| b.cmp(a));
        for col in columns_to_update {
            if let Some(mut column_data) = self.columns.remove(&col) {
                column_data.x += 1;
                self.columns.insert(col + 1, column_data);
            }
        }
    }

    pub fn insert_row(&mut self, row: i64) {
        self.has_value.insert_row(row, CopyFormats::None);
        for column in self.columns.values_mut() {
            let mut keys_to_move: Vec<i64> = column
                .values
                .keys()
                .filter(|&key| *key >= row)
                .cloned()
                .collect();

            keys_to_move.sort_unstable_by(|a, b| b.cmp(a));

            // Move down values
            for key in keys_to_move {
                if let Some(value) = column.values.remove(&key) {
                    column.values.insert(key + 1, value);
                }
            }
        }
    }

    pub fn remove_column(&mut self, column: i64) {
        self.has_value.remove_column(column);

        self.columns.remove(&column);

        // update the indices of all columns impacted by the deletion
        let mut columns_to_update = Vec::new();
        for col in self.columns.keys() {
            if *col > column {
                columns_to_update.push(*col);
            }
        }
        columns_to_update.sort();
        for col in columns_to_update {
            if let Some(mut column_data) = self.columns.remove(&col) {
                column_data.x -= 1;
                self.columns.insert(col - 1, column_data);
            }
        }
    }

    pub fn remove_row(&mut self, row: i64) {
        self.has_value.remove_row(row);
        for column in self.columns.values_mut() {
            column.values.remove(&row);

            let mut keys_to_move: Vec<i64> = column
                .values
                .keys()
                .filter(|&key| *key > row)
                .cloned()
                .collect();

            keys_to_move.sort_unstable();

            // Move up remaining values
            for key in keys_to_move {
                if let Some(value) = column.values.remove(&key) {
                    column.values.insert(key - 1, value);
                }
            }
        }
    }
}
