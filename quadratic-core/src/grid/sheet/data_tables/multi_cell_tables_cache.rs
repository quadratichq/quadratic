use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{
    Pos, Rect, Value,
    a1::RefRangeBounds,
    grid::{Contiguous2D, DataTable},
};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct MultiCellTablesCache {
    /// position map indicating presence of multi-cell data table at a position
    /// each position value is the root cell position of the data table
    /// this accounts for table spills hence values cannot overlap
    multi_cell_tables: Contiguous2D<Option<Pos>>,

    /// position map indicating presence of empty cells within a multi-cell data table
    /// this is used to assist with finding the next cell with content
    /// NOTE: the bool cannot be false
    multi_cell_tables_empty: Contiguous2D<Option<bool>>,
}

impl MultiCellTablesCache {
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
