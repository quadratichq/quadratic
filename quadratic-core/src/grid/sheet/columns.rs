use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, btree_map};

use crate::{
    Array, CellValue, CopyFormats, Pos, Rect,
    a1::UNBOUNDED,
    grid::{Column, Contiguous2D, Sheet},
};

// all fields are private intentionally, only use functions on this
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SheetColumns {
    #[serde(with = "crate::util::btreemap_serde")]
    columns: BTreeMap<i64, Column>,

    // boolean map indicating presence of value on the sheet column
    // uses Contiguous2D for efficient storage and fast lookup
    has_cell_value: Contiguous2D<Option<bool>>,
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

impl From<(BTreeMap<i64, Column>, Contiguous2D<Option<bool>>)> for SheetColumns {
    fn from(
        (columns, has_cell_value): (BTreeMap<i64, Column>, Contiguous2D<Option<bool>>),
    ) -> Self {
        Self {
            columns,
            has_cell_value,
        }
    }
}

impl SheetColumns {
    /// Creates a new instance of `SheetColumns` with empty columns and has_cell_value.
    pub(crate) fn new() -> Self {
        Self {
            columns: BTreeMap::new(),
            has_cell_value: Contiguous2D::new(),
        }
    }

    /// Returns the column at the given index.
    fn get_column(&self, column: i64) -> Option<&Column> {
        self.columns.get(&column)
    }

    /// Returns a mutable iterator over all columns. Used for file migration.
    pub(crate) fn iter_mut(&mut self) -> impl Iterator<Item = (&i64, &mut Column)> {
        self.columns.iter_mut()
    }

    /// Returns the bounds of the row at the given index.
    pub(crate) fn row_bounds(&self, row: i64) -> Option<(i64, i64)> {
        if self.has_cell_value.is_row_default(row) {
            return None;
        }

        (
            self.has_cell_value.row_min(row),
            self.has_cell_value.row_max(row),
        )
            .into()
    }

    /// Returns the finite bounds of the sheet columns.
    pub(crate) fn finite_bounds(&self) -> Option<Rect> {
        self.has_cell_value.finite_bounds()
    }

    /// Returns the value at the given position.
    pub(crate) fn get_value(&self, pos: &Pos) -> Option<&CellValue> {
        self.columns.get(&pos.x)?.values.get(&pos.y)
    }

    /// Returns the rectangles that have some value in the given rectangle.
    pub(crate) fn get_nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<bool>)> {
        self.has_cell_value.nondefault_rects_in_rect(rect)
    }

    /// Sets the value at the given position.
    fn set_value(&mut self, pos: Pos, value: impl Into<CellValue>) -> Option<CellValue> {
        let value = value.into();
        let is_empty = value.is_blank_or_empty_string();
        let value: Option<CellValue> = if is_empty { None } else { Some(value) };

        // if there's no value and the column doesn't exist, then nothing more needs to be done
        if value.is_none() && !self.columns.contains_key(&pos.x) {
            return None;
        }

        let column = match self.columns.entry(pos.x) {
            btree_map::Entry::Vacant(e) => e.insert(Column::new(pos.x)),
            btree_map::Entry::Occupied(e) => e.into_mut(),
        };

        if let Some(value) = value {
            self.has_cell_value.set(pos, Some(true));
            column.values.insert(pos.y, value)
        } else {
            self.has_cell_value.set(pos, None);
            column.values.remove(&pos.y)
        }
    }

    /// Deletes the values in the given rectangle.
    fn delete_values(&mut self, rect: Rect) -> Array {
        self.has_cell_value.set_rect(
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
                        .set(array_x, array_y, cell_value, false)
                        .expect("error inserting value into array of old cell values");
                }
            }
        }
        old_cell_values_array
    }

    /// Inserts a column at the given index, shifting the existing columns to the right.
    pub(crate) fn insert_column(&mut self, column: i64) {
        self.has_cell_value.insert_column(column, CopyFormats::None);

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

    /// Inserts a row at the given index, shifting the existing rows down.
    pub(crate) fn insert_row(&mut self, row: i64) {
        self.has_cell_value.insert_row(row, CopyFormats::None);

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

    /// Removes the column at the given index, shifting the existing columns to the left.
    pub(crate) fn remove_column(&mut self, column: i64) {
        self.has_cell_value.remove_column(column);

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

    /// Removes the row at the given index, shifting the existing rows up.
    pub(crate) fn remove_row(&mut self, row: i64) {
        self.has_cell_value.remove_row(row);

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

    /// Returns an iterator over the columns
    pub(crate) fn expensive_iter(&self) -> btree_map::Iter<'_, i64, Column> {
        self.columns.iter()
    }

    /// Returns a reference to has_cell_value cache to send to the client.
    pub(crate) fn has_cell_value_ref(&self) -> &Contiguous2D<Option<bool>> {
        &self.has_cell_value
    }

    /// Returns true if the given rectangle has any content.
    pub(crate) fn has_content_in_rect(&self, rect: Rect) -> bool {
        self.has_cell_value.intersects(rect)
    }

    /// Returns true if the given rectangle has any content.
    pub fn has_content(&self, rect: Rect) -> bool {
        self.has_cell_value.intersects(rect)
    }

    /// Returns an iterator over the content in the given rectangle.
    pub fn iter_content_in_rect(&self, rect: Rect) -> impl Iterator<Item = Pos> {
        self.has_cell_value
            .nondefault_rects_in_rect(rect)
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
    }

    /// Returns true if the given rectangle has any content, excluding a specific position.
    pub(crate) fn has_content_in_rect_except(&self, rect: Rect, except: Pos) -> bool {
        for y in rect.y_range() {
            for x in rect.x_range() {
                let pos = Pos { x, y };
                if pos == except {
                    continue;
                }
                if self.has_cell_value.get(pos) == Some(true) {
                    return true;
                }
            }
        }
        false
    }

    /// Returns an iterator over the content in the sheet.
    pub fn iter_content(&self) -> impl Iterator<Item = Pos> {
        self.has_cell_value
            .nondefault_rects_in_rect(Rect::new(1, 1, UNBOUNDED, UNBOUNDED))
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
    }
}

impl Sheet {
    pub(crate) fn set_value(&mut self, pos: Pos, value: impl Into<CellValue>) -> Option<CellValue> {
        self.columns.set_value(pos, value)
    }

    pub(crate) fn delete_values(&mut self, rect: Rect) -> Array {
        self.columns.delete_values(rect)
    }

    /// Returns a column of a sheet from the column index.
    pub(crate) fn get_column(&self, index: i64) -> Option<&Column> {
        self.columns.get_column(index)
    }

    /// This is expensive used only for file migration (< v1.7.1), having data in -ve coordinates
    /// and Contiguous2d cache does not work for -ve coordinates
    pub(crate) fn migration_finite_bounds(&self) -> Option<Rect> {
        let mut bounds: Option<Rect> = None;
        for (&x, column) in &self.columns.columns {
            if let Some(data_range) = column.range() {
                let column_bound = Rect::new(x, data_range.start, x, data_range.end - 1);
                bounds = bounds.map_or(Some(column_bound), |bounds| {
                    Some(bounds.union(&column_bound))
                });
            }
        }
        bounds
    }

    /// This is expensive used only for file migration (< v1.7.1), having data in -ve coordinates
    /// and Contiguous2d cache does not work for -ve coordinates
    pub(crate) fn migration_regenerate_has_cell_value(&mut self) {
        self.columns.has_cell_value.set_rect(1, 1, None, None, None);
        for (&x, column) in &self.columns.columns {
            if let Some(range) = column.range() {
                for y in range {
                    if column.has_data_in_row(y) {
                        self.columns.has_cell_value.set((x, y).into(), Some(true));
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod test {
    use crate::{CellValue, Pos, Rect, grid::sheet::columns::SheetColumns};

    #[test]
    fn test_set_and_get_value() {
        let mut columns = SheetColumns::new();
        let pos = Pos::new(1, 1);

        // Set and get a string value
        columns.set_value(pos, "test");
        assert_eq!(columns.get_value(&pos), Some(&CellValue::from("test")));

        // Set and get a number value
        let pos2 = Pos::new(2, 1);
        columns.set_value(pos2, 42.0);
        assert_eq!(columns.get_value(&pos2), Some(&CellValue::from(42.0)));

        // Test empty value
        columns.set_value(pos, "");
        assert_eq!(columns.get_value(&pos), None);
    }

    #[test]
    fn test_delete_values() {
        let mut columns = SheetColumns::new();

        // Set up some test data
        columns.set_value(pos![A1], "A1");
        columns.set_value(pos![A2], "A2");
        columns.set_value(pos![B1], "B1");
        columns.set_value(pos![B2], "B2");

        let rect = Rect::new_span((1, 1).into(), (2, 2).into());
        let deleted = columns.delete_values(rect);

        // Check that values were removed
        assert_eq!(columns.get_value(&Pos::new(1, 1)), None);
        assert_eq!(columns.get_value(&Pos::new(1, 2)), None);
        assert_eq!(columns.get_value(&Pos::new(2, 1)), None);
        assert_eq!(columns.get_value(&Pos::new(2, 2)), None);

        // Check that deleted array contains the original values
        assert_eq!(deleted.get(0, 0), Ok(&CellValue::from("A1")));
        assert_eq!(deleted.get(0, 1), Ok(&CellValue::from("A2")));
        assert_eq!(deleted.get(1, 0), Ok(&CellValue::from("B1")));
        assert_eq!(deleted.get(1, 1), Ok(&CellValue::from("B2")));
    }

    #[test]
    fn test_insert_and_remove_column() {
        let mut columns = SheetColumns::new();

        // Set up initial data
        columns.set_value(pos![A1], "A1");
        columns.set_value(pos![B1], "B1");

        // Insert a column at position 1
        columns.insert_column(1);

        // Check that data shifted right
        assert_eq!(columns.get_value(&Pos::new(1, 1)), None);
        assert_eq!(
            columns.get_value(&Pos::new(2, 1)),
            Some(&CellValue::from("A1"))
        );
        assert_eq!(
            columns.get_value(&Pos::new(3, 1)),
            Some(&CellValue::from("B1"))
        );

        // Remove the inserted column
        columns.remove_column(1);

        // Check that data shifted back
        assert_eq!(
            columns.get_value(&Pos::new(1, 1)),
            Some(&CellValue::from("A1"))
        );
        assert_eq!(
            columns.get_value(&Pos::new(2, 1)),
            Some(&CellValue::from("B1"))
        );
    }

    #[test]
    fn test_insert_and_remove_row() {
        let mut columns = SheetColumns::new();

        // Set up initial data
        columns.set_value(pos![A1], "A1");
        columns.set_value(pos![A2], "A2");

        // Insert a row at position 1
        columns.insert_row(1);

        // Check that data shifted down
        assert_eq!(columns.get_value(&Pos::new(1, 1)), None);
        assert_eq!(
            columns.get_value(&Pos::new(1, 2)),
            Some(&CellValue::from("A1"))
        );
        assert_eq!(
            columns.get_value(&Pos::new(1, 3)),
            Some(&CellValue::from("A2"))
        );

        // Remove the inserted row
        columns.remove_row(1);

        // Check that data shifted back
        assert_eq!(
            columns.get_value(&Pos::new(1, 1)),
            Some(&CellValue::from("A1"))
        );
        assert_eq!(
            columns.get_value(&Pos::new(1, 2)),
            Some(&CellValue::from("A2"))
        );
    }

    #[test]
    fn test_finite_bounds() {
        let mut columns = SheetColumns::new();

        // Empty sheet should have no bounds
        assert_eq!(columns.finite_bounds(), None);

        // Add some values
        columns.set_value(pos![A1], "A1");
        columns.set_value(pos![C4], "C4");

        // Check bounds
        let bounds = columns.finite_bounds().unwrap();
        assert_eq!(bounds.min.x, 1);
        assert_eq!(bounds.min.y, 1);
        assert_eq!(bounds.max.x, 3);
        assert_eq!(bounds.max.y, 4);
    }

    #[test]
    fn test_has_content_in_rect_except() {
        let mut columns = SheetColumns::new();

        // Set up some test data
        columns.set_value(pos![A1], "A1");
        columns.set_value(pos![A2], "A2");
        columns.set_value(pos![B1], "B1");
        columns.set_value(pos![B2], "B2");

        // Test that has_content_in_rect_except excludes the specified position
        let rect = Rect::new_span((1, 1).into(), (2, 2).into());

        // Should find content when excluding A1 (B1, A2, B2 still present)
        assert!(columns.has_content_in_rect_except(rect, pos![A1]));

        // Should find content when excluding B2 (A1, A2, B1 still present)
        assert!(columns.has_content_in_rect_except(rect, pos![B2]));

        // Should not find content when excluding all positions (if we exclude all 4)
        // Actually, this test is tricky because we can only exclude one at a time
        // But we can test that excluding a position that has content still finds other content

        // Test with a rect that only contains one cell
        let single_cell_rect = Rect::single_pos(pos![A1]);
        // Excluding A1 should return false (no other content)
        assert!(!columns.has_content_in_rect_except(single_cell_rect, pos![A1]));
        // But if we check a different position, it should find A1
        let single_cell_rect2 = Rect::single_pos(pos![A1]);
        assert!(columns.has_content_in_rect_except(single_cell_rect2, pos![B1]));
    }
}
