//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use crate::{
    Pos, Rect, SheetPos,
    a1::{A1Context, A1Selection},
    grid::{
        CodeCellLanguage, Contiguous2D,
        sheet::data_tables::{
            in_table_code::InTableCode, multi_cell_tables_cache::MultiCellTablesCache,
        },
    },
};

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
                        {
                            if table.language != CodeCellLanguage::Import {
                                return true;
                            }
                        }
                    }
                }

                // check in-table code tables
                if let Some(tables) = &self.in_table_code {
                    if tables.has_code_in_rect(rect) {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Merges the single cell data table into the parent cache.
    pub fn merge_single_cell(
        &mut self,
        sheet_pos: SheetPos,
        single_cell_code: Contiguous2D<Option<bool>>,
        y_adjustment: i64,
    ) {
        let in_table_code = if let Some(in_table_code) = self.in_table_code.as_mut() {
            in_table_code
        } else {
            let in_table_code = InTableCode::default();
            self.in_table_code = Some(in_table_code);
            &mut *self.in_table_code.as_mut().unwrap()
        };
        single_cell_code.to_rects().for_each(|(x0, y0, x1, y1, _)| {
            let x1 = x1.unwrap_or(x0);
            let y1 = y1.unwrap_or(y0);
            in_table_code.set_single_cell_code(
                Rect::new(
                    sheet_pos.x + x0 - 1,
                    sheet_pos.y + y0 - 1 + y_adjustment,
                    sheet_pos.x + x1 - 1,
                    sheet_pos.y + y1 - 1 + y_adjustment,
                ),
                sheet_pos.into(),
            );
        });
    }
}

#[cfg(test)]
mod tests {
    use crate::{a1::A1Selection, grid::CodeCellLanguage, test_util::*};

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
    fn test_code_in_selection_with_in_table_code() {
        let (mut gc, sheet_id) = test_grid();

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);
        gc.set_code_cell(
            pos![sheet_id!A3],
            CodeCellLanguage::Formula,
            "123".to_string(),
            None,
            None,
        );
    }
}
