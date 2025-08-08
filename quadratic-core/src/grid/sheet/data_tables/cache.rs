//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use crate::{
    Pos, Rect,
    a1::{A1Context, A1Selection, RefRangeBounds},
    grid::{
        CodeCellLanguage, Contiguous2D, DataTable,
        sheet::data_tables::{
            in_table_code::InTableCode, multi_cell_tables_cache::MultiCellTablesCache,
        },
    },
};

use itertools::Itertools;
use serde::{Deserialize, Serialize};

#[cfg(feature = "js")]
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

    // cache of code tables that are in a table
    pub(crate) in_table_code: Option<InTableCode>,
}

impl SheetDataTablesCache {
    /// Returns the bounds of the column or None if the column is empty of content.
    pub fn column_bounds(&self, column: i64) -> Option<(i64, i64)> {
        let single_cell_min = self.single_cell_tables.col_min(column);
        let multi_cell_min = self.multi_cell_tables.col_min(column);
        let min = match (single_cell_min >= 0, multi_cell_min >= 0) {
            (true, true) => single_cell_min.min(multi_cell_min),
            (true, false) => single_cell_min,
            (false, true) => multi_cell_min,
            (false, false) => return None,
        };

        let single_cell_max = self.single_cell_tables.col_max(column);
        let multi_cell_max = self.multi_cell_tables.col_max(column);
        let max = match (single_cell_max >= 0, multi_cell_max >= 0) {
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
        let min = match (single_cell_min >= 0, multi_cell_min >= 0) {
            (true, true) => single_cell_min.min(multi_cell_min),
            (true, false) => single_cell_min,
            (false, true) => multi_cell_min,
            (false, false) => return None,
        };

        let single_cell_max = self.single_cell_tables.row_max(row);
        let multi_cell_max = self.multi_cell_tables.row_max(row);
        let max = match (single_cell_max >= 0, multi_cell_max >= 0) {
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

    /// Returns whether there are any code cells within a selection
    pub fn code_in_selection(&self, selection: &A1Selection, context: &A1Context) -> bool {
        let sheet_id = selection.sheet_id;
        for range in selection.ranges.iter() {
            if let Some(rect) = range.to_rect_unbounded(context) {
                if !self.single_cell_tables.is_all_default_in_rect(rect) {
                    return true;
                }
                let tables = self.multi_cell_tables.unique_values_in_rect(rect);
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

                // check in-table code tables
                if let Some(tables) = &self.in_table_code
                    && tables.has_code_in_rect(rect)
                {
                    return true;
                }
            }
        }
        false
    }

    /// Returns the unique table anchor positions in range
    pub fn tables_in_range(&self, range: RefRangeBounds) -> impl Iterator<Item = Pos> {
        self.single_cell_tables
            .nondefault_rects_in_range(range)
            .flat_map(|(rect, _)| {
                rect.x_range()
                    .flat_map(move |x| rect.y_range().map(move |y| Pos { x, y }))
            })
            .chain(
                self.multi_cell_tables
                    .unique_values_in_range(range)
                    .into_iter()
                    .flatten(),
            )
    }

    /// Returns the rectangles that have some value in the given rectangle.
    pub fn get_nondefault_rects_in_rect(&self, rect: Rect) -> impl Iterator<Item = Rect> {
        self.single_cell_tables
            .nondefault_rects_in_rect(rect)
            .map(|(rect, _)| rect)
            .chain(
                self.multi_cell_tables
                    .nondefault_rects_in_rect(rect)
                    .map(|(rect, _)| rect),
            )
    }

    /// Removes the in-table code tables that are within the given rect.
    pub(super) fn remove_from_in_table_code(&mut self, old_spilled_output_rect: Rect) {
        let Some(in_table_code) = self.in_table_code.as_mut() else {
            return;
        };

        in_table_code.clear_table(old_spilled_output_rect);

        self.check_and_remove_in_table_code();
    }

    /// Merges the single cell data table into the parent cache.
    pub(super) fn add_to_in_table_code(&mut self, data_table_pos: Pos, data_table: &DataTable) {
        let Some(sub_tables) = data_table.tables.as_ref() else {
            return;
        };

        let y_adjustment = data_table.y_adjustment(true);

        let mut single_cell_tables = sub_tables.cache.single_cell_tables.to_owned();

        // handle hidden columns
        if let Some(column_headers) = &data_table.column_headers {
            for column_header in column_headers
                .iter()
                .sorted_by(|a, b| b.value_index.cmp(&a.value_index))
            {
                if !column_header.display {
                    single_cell_tables.remove_column(column_header.value_index as i64);
                }
            }
        }

        // handle sorted rows
        if let Some(display_buffer) = &data_table.display_buffer {
            let mut sorted_single_cell_tables = Contiguous2D::new();
            for (display_row, &actual_row) in display_buffer.iter().enumerate() {
                if let Some(mut row) = single_cell_tables.copy_row(actual_row as i64) {
                    row.translate_in_place(0, display_row as i64 - actual_row as i64);
                    sorted_single_cell_tables.set_from(&row);
                }
            }
            std::mem::swap(&mut single_cell_tables, &mut sorted_single_cell_tables);
        }

        // convert to sheet coordinates
        single_cell_tables.translate_in_place(data_table_pos.x, data_table_pos.y + y_adjustment);

        single_cell_tables
            .nondefault_rects_in_rect(Rect::new(0, 0, i64::MAX, i64::MAX))
            .for_each(|(rect, _)| {
                self.in_table_code
                    .get_or_insert_default()
                    .set_single_cell_code(rect, data_table_pos);
            });

        self.check_and_remove_in_table_code();
    }

    fn check_and_remove_in_table_code(&mut self) {
        if self
            .in_table_code
            .as_ref()
            .map(|in_table_code| in_table_code.is_all_default())
            .unwrap_or(false)
        {
            self.in_table_code = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Rect,
        a1::{A1Selection, RefRangeBounds},
        grid::CodeCellLanguage,
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

        dbg!(sheet_data_tables_cache);

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

        // Create a single-cell code table
        test_create_code_table(&mut gc, sheet_id, pos![2, 2], 1, 1);

        // Create a multi-cell code table
        test_create_code_table(&mut gc, sheet_id, pos![4, 2], 3, 1);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        // Test selection containing single-cell code table
        let selection = A1Selection::test_a1("B2");
        assert!(sheet_data_tables_cache.code_in_selection(&selection, context));

        // Test selection containing multi-cell code table
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

        gc.set_cell_value(pos![sheet_id!2,2], "=1".to_string(), None, false);

        test_create_data_table(&mut gc, sheet_id, pos![5, 5], 3, 3);

        test_create_data_table(&mut gc, sheet_id, pos![10, 10], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let tables = sheet_data_tables_cache
            .tables_in_range(RefRangeBounds::new_relative(1, 1, 6, 6))
            .collect::<Vec<_>>();

        assert_eq!(tables, vec![pos![2, 2], pos![5, 5]]);
    }

    #[test]
    fn test_get_nondefault_rects_in_rect() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!2,2], "=1".to_string(), None, false);

        test_create_data_table(&mut gc, sheet_id, pos![5, 5], 3, 3);

        test_create_data_table(&mut gc, sheet_id, pos![10, 10], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let rects = sheet_data_tables_cache
            .get_nondefault_rects_in_rect(Rect::new(1, 1, 12, 12))
            .collect::<Vec<_>>();

        assert_eq!(rects, vec![rect![B2:B2], rect![E5:G9], rect![J10:L12]]);
    }

    #[test]
    fn test_code_in_selection_with_in_table_code() {
        let (mut gc, sheet_id) = test_grid();

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);
        gc.set_code_cell(
            pos![sheet_id!A3],
            CodeCellLanguage::Formula,
            "123".to_string(),
            None,
            None,
            false,
        );
    }
}
