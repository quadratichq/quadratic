//! Extension methods for A1Selection that require core types.

use std::collections::HashSet;

use crate::a1::{A1Context, A1Selection, CellRefRange, ColRange};
use crate::grid::Sheet;
use crate::grid::sheet::data_tables::cache::SheetDataTablesCache;
use crate::Pos;
use crate::grid::SheetId;

/// Extension trait for A1Selection methods that require core types.
pub trait A1SelectionExt {
    /// Converts to a set of quadrant positions.
    fn rects_to_hashes(&self, sheet: &Sheet, a1_context: &A1Context) -> HashSet<Pos>;

    /// Returns the names of tables that are fully selected.
    fn selected_table_names(
        &self,
        sheet_id: SheetId,
        data_tables_cache: &SheetDataTablesCache,
        context: &A1Context,
    ) -> Vec<String>;
}

impl A1SelectionExt for A1Selection {
    fn rects_to_hashes(&self, sheet: &Sheet, a1_context: &A1Context) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        let finite_selection = sheet.finitize_selection(self, false, false, false, a1_context);
        finite_selection.ranges.iter().for_each(|range| {
            // handle finite ranges
            if let Some(rect) = range.to_rect(a1_context) {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        let mut pos = Pos { x, y };
                        pos.to_quadrant();
                        hashes.insert(pos);
                    }
                }
            }
        });
        hashes
    }

    fn selected_table_names(
        &self,
        sheet_id: SheetId,
        data_tables_cache: &SheetDataTablesCache,
        context: &A1Context,
    ) -> Vec<String> {
        let mut names = Vec::new();
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Table { range } => {
                if range.data && range.col_range == ColRange::All {
                    names.push(range.table_name.clone());
                }
            }
            CellRefRange::Sheet { range } => {
                for table_pos in data_tables_cache.tables_in_range(*range) {
                    if let Some(table) = context
                        .table_map
                        .table_from_pos(table_pos.to_sheet_pos(sheet_id))
                    {
                        // ensure the table name is intersected by the range
                        if table.bounds.len() == 1
                            || (table.show_name
                                && range.might_intersect_rect(crate::Rect::new(
                                    table.bounds.min.x,
                                    table.bounds.min.y,
                                    table.bounds.max.x,
                                    1,
                                )))
                        {
                            names.push(table.table_name.clone());
                        }
                    }
                }
            }
        });
        names
    }
}
