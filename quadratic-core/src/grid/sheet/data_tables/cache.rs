//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use std::collections::HashSet;

use crate::{
    Pos, Rect, Value,
    a1::RefRangeBounds,
    grid::{Contiguous2D, DataTable},
};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetDataTablesCache {
    // boolean map indicating presence of single cell data table at a position
    // this takes spills and errors into account, which are also single cell tables
    // NOTE: the bool cannot be false
    pub(crate) single_cell_tables: Contiguous2D<Option<bool>>,

    // cache of output rect and empty values for multi-cell data tables
    pub(crate) multi_cell_tables: MultiCellTablesCache,
}

impl SheetDataTablesCache {
    /// Returns the bounds of the column or None if the column is empty of content.
    pub fn column_bounds(&self, column: i64) -> Option<(i64, i64)> {
        let single_cell_min = self.single_cell_tables.col_min(column);
        let multi_cell_min = self.multi_cell_tables.col_min(column);
        let min = match (single_cell_min > 0, multi_cell_min > 0) {
            (true, true) => single_cell_min.min(multi_cell_min),
            (true, false) => single_cell_min,
            (false, true) => multi_cell_min,
            (false, false) => return None,
        };

        let single_cell_max = self.single_cell_tables.col_max(column);
        let multi_cell_max = self.multi_cell_tables.col_max(column);
        let max = match (single_cell_max > 0, multi_cell_max > 0) {
            (true, true) => single_cell_max.max(multi_cell_max),
            (true, false) => single_cell_max,
            (false, true) => multi_cell_max,
            (false, false) => return None,
        };

        Some((min, max))
    }

    /// Returns the bounds of the row or None if the row is empty of content.
    pub fn row_bounds(&self, row: i64) -> Option<(i64, i64)> {
        let single_cell_min = self.single_cell_tables.row_min(row);
        let multi_cell_min = self.multi_cell_tables.row_min(row);
        let min = match (single_cell_min > 0, multi_cell_min > 0) {
            (true, true) => single_cell_min.min(multi_cell_min),
            (true, false) => single_cell_min,
            (false, true) => multi_cell_min,
            (false, false) => return None,
        };

        let single_cell_max = self.single_cell_tables.row_max(row);
        let multi_cell_max = self.multi_cell_tables.row_max(row);
        let max = match (single_cell_max > 0, multi_cell_max > 0) {
            (true, true) => single_cell_max.max(multi_cell_max),
            (true, false) => single_cell_max,
            (false, true) => multi_cell_max,
            (false, false) => return None,
        };

        Some((min, max))
    }

    /// Returns the finite bounds of the sheet data tables.
    pub fn finite_bounds(&self) -> Option<Rect> {
        match (
            self.single_cell_tables.finite_bounds(),
            self.multi_cell_tables.finite_bounds(),
        ) {
            (Some(has_data_table_bounds), Some(output_rects_bounds)) => {
                Some(has_data_table_bounds.union(&output_rects_bounds))
            }
            (Some(has_data_table_bounds), None) => Some(has_data_table_bounds),
            (None, Some(output_rects_bounds)) => Some(output_rects_bounds),
            (None, None) => None,
        }
    }

    /// Returns the anchor position of the data table which contains the given position, if it exists.
    pub fn get_pos_contains(&self, pos: Pos) -> Option<Pos> {
        if self.single_cell_tables.get(pos).is_some() {
            Some(pos)
        } else {
            self.multi_cell_tables.get(pos)
        }
    }

    /// Returns true if the cell has content, ignoring blank cells within a
    /// multi-cell data table.
    pub fn has_content_ignore_blank_table(&self, pos: Pos) -> bool {
        self.single_cell_tables.get(pos).is_some()
            || self
                .multi_cell_tables
                .get(pos)
                .is_some_and(|_| !self.has_empty_value(pos))
    }

    /// Returns true if the cell has an empty value
    pub fn has_empty_value(&self, pos: Pos) -> bool {
        self.multi_cell_tables.has_empty_value(pos)
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MultiCellTablesCache {
    // position map indicating presence of multi-cell data table at a position
    // each position value is the root cell position of the data table
    // this accounts for table spills hence values cannot overlap
    multi_cell_tables: Contiguous2D<Option<Pos>>,

    // position map indicating presence of empty cells within a multi-cell data table
    // this is used to assist with finding the next cell with content
    // NOTE: the bool cannot be false
    multi_cell_tables_empty: Contiguous2D<Option<bool>>,
}

impl MultiCellTablesCache {
    pub fn new() -> Self {
        Self {
            multi_cell_tables: Contiguous2D::new(),
            multi_cell_tables_empty: Contiguous2D::new(),
        }
    }

    /// Returns anchor position of the data table whose output rect contains the given position
    pub fn get(&self, pos: Pos) -> Option<Pos> {
        self.multi_cell_tables.get(pos)
    }

    pub fn set_rect(&mut self, x1: i64, y1: i64, x2: i64, y2: i64, data_table: Option<&DataTable>) {
        if let Some(data_table) = data_table {
            // Update output rect
            self.multi_cell_tables
                .set_rect(x1, y1, Some(x2), Some(y2), Some((x1, y1).into()));

            // Multi Value, update empty values cache
            if let Value::Array(array) = &data_table.value {
                if let Some(mut empty_values_cache) = array.empty_values_cache_owned() {
                    let y_adjustment = data_table.y_adjustment(true);

                    // handle hidden columns
                    if let Some(column_headers) = &data_table.column_headers {
                        for column_header in column_headers.iter() {
                            if !column_header.display {
                                empty_values_cache
                                    .remove_column(column_header.value_index as i64 + 1);
                            }
                        }
                    }

                    // handle sorted rows
                    if let Some(display_buffer) = &data_table.display_buffer {
                        let mut sorted_empty_values_cache = Contiguous2D::new();
                        for (display_row, &actual_row) in display_buffer.iter().enumerate() {
                            if let Some(mut row) =
                                empty_values_cache.copy_row(actual_row as i64 + 1)
                            {
                                row.translate_in_place(0, display_row as i64 - actual_row as i64);
                                sorted_empty_values_cache.set_from(&row);
                            }
                        }
                        std::mem::swap(&mut empty_values_cache, &mut sorted_empty_values_cache);
                    }

                    // convert to sheet coordinates
                    empty_values_cache.translate_in_place(x1 - 1, y1 - 1 + y_adjustment);
                    self.multi_cell_tables_empty.set_from(&empty_values_cache);

                    // mark table name and column headers as non-empty
                    if y_adjustment > 0 {
                        self.multi_cell_tables_empty.set_rect(
                            x1,
                            y1,
                            Some(x2),
                            Some(y1 - 1 + y_adjustment),
                            None,
                        );
                    }
                } else {
                    // empty_values_cache is None, all cells are non-empty
                    self.multi_cell_tables_empty
                        .set_rect(x1, y1, Some(x2), Some(y2), None);
                }
            }
        }
        // table is removed, set all to None
        else {
            self.multi_cell_tables
                .set_rect(x1, y1, Some(x2), Some(y2), None);

            self.multi_cell_tables_empty
                .set_rect(x1, y1, Some(x2), Some(y2), None);
        }
    }

    /// Returns true if all cells in the rect do not have a table output
    pub fn is_all_default_in_rect(&self, rect: Rect) -> bool {
        self.multi_cell_tables.is_all_default_in_rect(rect)
    }

    /// Return rects which have table output
    pub fn nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<Pos>)> {
        self.multi_cell_tables.nondefault_rects_in_rect(rect)
    }

    /// Returns the unique table anchor positions in rect
    pub fn unique_values_in_rect(&self, rect: Rect) -> HashSet<Option<Pos>> {
        self.multi_cell_tables.unique_values_in_rect(rect)
    }

    /// Returns the unique table anchor positions in range
    pub fn unique_values_in_range(&self, range: RefRangeBounds) -> HashSet<Option<Pos>> {
        self.multi_cell_tables.unique_values_in_range(range)
    }

    /// Returns the minimum column index of the multi-cell data tables
    pub fn col_min(&self, column: i64) -> i64 {
        self.multi_cell_tables.col_min(column)
    }

    /// Returns the maximum column index of the multi-cell data tables
    pub fn col_max(&self, column: i64) -> i64 {
        self.multi_cell_tables.col_max(column)
    }

    /// Returns the minimum row index of the multi-cell data tables
    pub fn row_min(&self, row: i64) -> i64 {
        self.multi_cell_tables.row_min(row)
    }

    /// Returns the maximum row index of the multi-cell data tables
    pub fn row_max(&self, row: i64) -> i64 {
        self.multi_cell_tables.row_max(row)
    }

    /// Returns the finite bounds of the multi-cell data tables
    pub fn finite_bounds(&self) -> Option<Rect> {
        self.multi_cell_tables.finite_bounds()
    }

    /// Returns true if the cell has an empty value
    pub fn has_empty_value(&self, pos: Pos) -> bool {
        self.multi_cell_tables_empty.get(pos).is_some()
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::*;

    #[test]
    fn test_has_content_ignore_blank_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table_with_values(&mut gc, sheet_id, pos![2, 2], 3, 1, &["1", "", "3"]);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![3, 4]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![4, 4]));
    }

    #[test]
    fn test_blanks_within_code_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table_with_values(
            &mut gc,
            sheet_id,
            pos![2, 2],
            6,
            1,
            &["1", "2", "", "", "5", "6"],
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        print_first_sheet(&gc);

        dbg!(sheet_data_tables_cache);

        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![2, 2]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![3, 2]));
        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![4, 2]));
        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![5, 2]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![6, 2]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![7, 2]));
        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![8, 2]));
    }
}
