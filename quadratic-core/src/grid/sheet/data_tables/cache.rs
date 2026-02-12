//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use std::collections::HashSet;

use crate::{
    Pos, Rect, Value,
    a1::{A1Context, A1Selection, RefRangeBounds},
    grid::{CodeCellLanguage, Contiguous2D, DataTable},
};

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetDataTablesCache {
    // cache of output rect and empty values for all data tables (including single-cell)
    pub(crate) data_tables: DataTablesCache,
}

impl SheetDataTablesCache {
    /// Returns the bounds of the column or None if the column is empty of content.
    pub fn column_bounds(&self, column: i64) -> Option<(i64, i64)> {
        let min = self.data_tables.col_min(column);
        let max = self.data_tables.col_max(column);
        if min > 0 && max > 0 {
            Some((min, max))
        } else {
            None
        }
    }

    /// Returns the bounds of the row or None if the row is empty of content.
    pub fn row_bounds(&self, row: i64) -> Option<(i64, i64)> {
        let min = self.data_tables.row_min(row);
        let max = self.data_tables.row_max(row);
        if min > 0 && max > 0 {
            Some((min, max))
        } else {
            None
        }
    }

    /// Returns the finite bounds of the sheet data tables.
    pub fn finite_bounds(&mut self) -> Option<Rect> {
        self.data_tables.finite_bounds()
    }

    /// Returns the anchor position of the data table which contains the given position, if it exists.
    pub fn get_pos_contains(&self, pos: Pos) -> Option<Pos> {
        self.data_tables.get(pos)
    }

    /// Returns true if the cell has content, ignoring blank cells within a
    /// data table.
    pub fn has_content_ignore_blank_table(&self, pos: Pos) -> bool {
        self.data_tables
            .get(pos)
            .is_some_and(|_| !self.has_empty_value(pos))
    }

    /// Returns true if the cell has an empty value
    pub fn has_empty_value(&self, pos: Pos) -> bool {
        self.data_tables.has_empty_value(pos)
    }

    /// Returns whether there are any code cells within a selection
    pub fn code_in_selection(&self, selection: &A1Selection, context: &A1Context) -> bool {
        let sheet_id = selection.sheet_id;
        for range in selection.ranges.iter() {
            if let Some(rect) = range.to_rect_unbounded(context) {
                let tables = self.data_tables.unique_values_in_rect(rect);
                if !tables.is_empty() {
                    for table_pos in tables.iter().flatten() {
                        if let Some(table) =
                            context.table_from_pos(table_pos.to_sheet_pos(sheet_id))
                            && table.language != CodeCellLanguage::Import
                        {
                            return true;
                        }
                    }
                }
            }
        }
        false
    }

    /// Returns the unique table anchor positions in range
    pub fn tables_in_range(&self, range: RefRangeBounds) -> impl Iterator<Item = Pos> {
        self.data_tables
            .unique_values_in_range(range)
            .into_iter()
            .flatten()
    }

    /// Returns the rectangles that have some value in the given rectangle.
    pub fn get_nondefault_rects_in_rect(&self, rect: Rect) -> impl Iterator<Item = Rect> {
        self.data_tables
            .nondefault_rects_in_rect(rect)
            .map(|(rect, _)| rect)
    }

    pub fn has_content_in_rect(&self, rect: Rect) -> bool {
        self.data_tables.has_content_in_rect(rect)
    }

    /// Checks for any tables in the rect except for the given position
    pub fn has_content_except(&self, rect: Rect, except: Pos) -> bool {
        self.data_tables
            .nondefault_rects_in_rect(rect)
            .any(|(_, pos)| pos.is_some_and(|p| p != except))
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone)]
pub struct DataTablesCache {
    /// position map indicating presence of data table at a position
    /// each position value is the root cell position of the data table
    /// this accounts for table spills hence values cannot overlap
    data_tables: Contiguous2D<Option<Pos>>,

    /// position map indicating presence of empty cells within a data table
    /// this is used to assist with finding the next cell with content
    /// NOTE: the bool cannot be false
    data_tables_empty: Contiguous2D<Option<bool>>,

    /// Cached bounds for O(1) access - expanded on additions
    #[serde(skip)]
    cached_bounds: Option<Rect>,

    /// Flag indicating bounds may have shrunk and need full recalc
    #[serde(skip)]
    bounds_dirty: bool,
}

// Manual PartialEq implementation that excludes cached fields
impl PartialEq for DataTablesCache {
    fn eq(&self, other: &Self) -> bool {
        self.data_tables == other.data_tables && self.data_tables_empty == other.data_tables_empty
    }
}

impl DataTablesCache {
    pub fn new() -> Self {
        Self {
            data_tables: Contiguous2D::new(),
            data_tables_empty: Contiguous2D::new(),
            cached_bounds: None,
            bounds_dirty: false,
        }
    }

    /// Returns anchor position of the data table whose output rect contains the given position
    pub fn get(&self, pos: Pos) -> Option<Pos> {
        self.data_tables.get(pos)
    }

    pub fn set_rect(&mut self, x1: i64, y1: i64, x2: i64, y2: i64, data_table: Option<&DataTable>) {
        let new_rect = Rect::new(x1, y1, x2, y2);

        if let Some(data_table) = data_table {
            // Update cached bounds - expand if needed (O(1))
            self.cached_bounds = Some(match self.cached_bounds {
                Some(existing) => existing.union(&new_rect),
                None => new_rect,
            });

            // Update output rect
            self.data_tables
                .set_rect(x1, y1, Some(x2), Some(y2), Some((x1, y1).into()));

            // For single-cell tables, no need to track empty values
            if new_rect.len() == 1 {
                self.data_tables_empty
                    .set_rect(x1, y1, Some(x2), Some(y2), None);
                return;
            }

            // Multi Value, update empty values cache
            if let Value::Array(array) = &data_table.value {
                if let Some(mut empty_values_cache) = array.empty_values_cache_owned() {
                    let y_adjustment = data_table.y_adjustment(true);

                    // handle hidden columns
                    if let Some(column_headers) = &data_table.column_headers {
                        for column_header in column_headers
                            .iter()
                            .sorted_by(|a, b| b.value_index.cmp(&a.value_index))
                        {
                            if !column_header.display {
                                empty_values_cache
                                    .remove_column(column_header.value_index as i64 + 1);
                            }
                        }
                    }

                    // handle sorted rows
                    let empty_values_cache =
                        if let Some(reverse_display_buffer) =
                            data_table.get_reverse_display_buffer()
                        {
                            let mut empty_rects = vec![];

                            for (rect, value) in empty_values_cache
                                .nondefault_rects_in_rect(Rect::new(1, 1, i64::MAX, i64::MAX))
                            {
                                if value == Some(Some(true)) {
                                    for y in rect.y_range() {
                                        if let Ok(actual_row) = u64::try_from(y - 1) {
                                            let display_row = data_table
                                                .get_display_index_from_reverse_display_buffer(
                                                    actual_row,
                                                    Some(&reverse_display_buffer),
                                                );

                                            empty_rects.push(Rect::new(
                                                x1 + rect.min.x - 1,
                                                y1 + y_adjustment + display_row as i64,
                                                x1 + rect.max.x - 1,
                                                y1 + y_adjustment + display_row as i64,
                                            ));
                                        }
                                    }
                                }
                            }

                            let mut sorted_empty_values_cache = Contiguous2D::new();
                            sorted_empty_values_cache.set_rect(
                                x1,
                                y1 + y_adjustment,
                                Some(x2),
                                Some(y2),
                                Some(None),
                            );

                            empty_rects.sort_by(|a, b| (a.min.y, a.min.x).cmp(&(b.min.y, b.min.x)));
                            for rect in empty_rects {
                                sorted_empty_values_cache.set_rect(
                                    rect.min.x,
                                    rect.min.y,
                                    Some(rect.max.x),
                                    Some(rect.max.y),
                                    Some(Some(true)),
                                );
                            }

                            sorted_empty_values_cache
                        } else {
                            // convert to sheet coordinates
                            empty_values_cache.translate_in_place(x1 - 1, y1 + y_adjustment - 1);
                            empty_values_cache
                        };

                    self.data_tables_empty.set_from(&empty_values_cache);

                    // mark table name and column headers as non-empty
                    if y_adjustment > 0 {
                        self.data_tables_empty.set_rect(
                            x1,
                            y1,
                            Some(x2),
                            Some(y1 + y_adjustment - 1),
                            None,
                        );
                    }
                } else {
                    // empty_values_cache is None, all cells are non-empty
                    self.data_tables_empty
                        .set_rect(x1, y1, Some(x2), Some(y2), None);
                }
            }
        }
        // table is removed, set all to None
        else {
            self.data_tables.set_rect(x1, y1, Some(x2), Some(y2), None);

            self.data_tables_empty
                .set_rect(x1, y1, Some(x2), Some(y2), None);

            // Mark bounds as dirty if removal touches the edge of current bounds
            if let Some(bounds) = &self.cached_bounds
                && (new_rect.min.x <= bounds.min.x
                    || new_rect.max.x >= bounds.max.x
                    || new_rect.min.y <= bounds.min.y
                    || new_rect.max.y >= bounds.max.y)
            {
                self.bounds_dirty = true;
            }
        }
    }

    /// Returns true if all cells in the rect do not have a table output
    pub fn is_all_default_in_rect(&self, rect: Rect) -> bool {
        self.data_tables.is_all_default_in_rect(rect)
    }

    /// Return rects which have table output
    pub fn nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<Pos>)> {
        self.data_tables.nondefault_rects_in_rect(rect)
    }

    /// Returns the unique table anchor positions in rect
    pub fn unique_values_in_rect(&self, rect: Rect) -> HashSet<Option<Pos>> {
        self.data_tables.unique_values_in_rect(rect)
    }

    /// Returns the unique table anchor positions in range
    pub fn unique_values_in_range(&self, range: RefRangeBounds) -> HashSet<Option<Pos>> {
        self.data_tables.unique_values_in_range(range)
    }

    /// Returns the minimum column index of the data tables
    pub fn col_min(&self, column: i64) -> i64 {
        self.data_tables.col_min(column)
    }

    /// Returns the maximum column index of the data tables
    pub fn col_max(&self, column: i64) -> i64 {
        self.data_tables.col_max(column)
    }

    /// Returns the minimum row index of the data tables
    pub fn row_min(&self, row: i64) -> i64 {
        self.data_tables.row_min(row)
    }

    /// Returns the maximum row index of the data tables
    pub fn row_max(&self, row: i64) -> i64 {
        self.data_tables.row_max(row)
    }

    /// Returns the finite bounds of the data tables.
    /// Uses cached bounds for O(1) performance when not dirty.
    pub fn finite_bounds(&mut self) -> Option<Rect> {
        if self.bounds_dirty {
            // Full recalculation needed after edge removal
            self.cached_bounds = self.data_tables.finite_bounds();
            self.bounds_dirty = false;
        }
        self.cached_bounds
    }

    /// Returns true if the cell has an empty value
    pub fn has_empty_value(&self, pos: Pos) -> bool {
        self.data_tables_empty.get(pos).is_some()
    }

    pub fn has_content_in_rect(&self, rect: Rect) -> bool {
        self.data_tables.intersects(rect)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Rect,
        a1::{A1Selection, RefRangeBounds},
        test_util::*,
    };

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

        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![2, 2]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![3, 2]));
        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![4, 2]));
        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![5, 2]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![6, 2]));
        assert!(sheet_data_tables_cache.has_content_ignore_blank_table(pos![7, 2]));
        assert!(!sheet_data_tables_cache.has_content_ignore_blank_table(pos![8, 2]));
    }

    #[test]
    fn test_code_in_selection() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create a multi-cell code table (1x1 formulas become CellValue::Code, not DataTable)
        test_create_code_table(&mut gc, sheet_id, pos![2, 2], 2, 1);

        // Create another multi-cell code table
        test_create_code_table(&mut gc, sheet_id, pos![4, 2], 3, 1);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        // Test selection containing first code table
        let selection = A1Selection::test_a1("B2:C2");
        assert!(sheet_data_tables_cache.code_in_selection(&selection, context));

        // Test selection containing second code table
        let selection = A1Selection::test_a1("D2:F2");
        assert!(sheet_data_tables_cache.code_in_selection(&selection, context));

        // Test selection containing both tables
        let selection = A1Selection::test_a1("B2:F2");
        assert!(sheet_data_tables_cache.code_in_selection(&selection, context));

        // Test empty selection
        let selection = A1Selection::test_a1("J10");
        assert!(!sheet_data_tables_cache.code_in_selection(&selection, context));

        // Test selection with no code tables
        let selection = A1Selection::test_a1("A1");
        assert!(!sheet_data_tables_cache.code_in_selection(&selection, context));
    }

    #[test]
    fn test_tables_in_range() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create multi-cell tables (1x1 formulas become CellValue::Code)
        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);
        test_create_data_table(&mut gc, sheet_id, pos![E5], 3, 3);
        test_create_data_table(&mut gc, sheet_id, pos![J10], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let tables = sheet_data_tables_cache
            .tables_in_range(RefRangeBounds::new_relative(1, 1, 6, 6))
            .collect::<Vec<_>>();

        assert_eq!(tables.len(), 2);
        assert!(tables.contains(&pos![B2]));
        assert!(tables.contains(&pos![E5]));
    }

    #[test]
    fn test_get_nondefault_rects_in_rect() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create multi-cell tables (1x1 formulas become CellValue::Code)
        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);
        test_create_data_table(&mut gc, sheet_id, pos![5, 5], 3, 3);
        test_create_data_table(&mut gc, sheet_id, pos![10, 10], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let rects = sheet_data_tables_cache
            .get_nondefault_rects_in_rect(Rect::new(1, 1, 12, 12))
            .collect::<Vec<_>>();

        assert_eq!(rects.len(), 3);
        assert!(rects.contains(&rect![B2:C5]));
        assert!(rects.contains(&rect![E5:G9]));
        assert!(rects.contains(&rect![J10:L12]));
    }
}
