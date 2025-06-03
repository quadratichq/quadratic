//! Helper functions for getting data from the cache.

use crate::a1::{A1Context, TableMapEntry};
use crate::grid::sheet::data_tables::cache::SheetDataTablesCache;
use crate::wasm_bindings::sheet_content_cache::SheetContentCache;
use crate::{Rect, SheetPos};

/// Gets the Table that intersects a given position.
pub fn table_at<'a>(
    sheet_pos: SheetPos,
    table_cache: &SheetDataTablesCache,
    context: &'a A1Context,
) -> Option<&'a TableMapEntry> {
    let table_pos = match table_cache.multi_cell_tables.get(sheet_pos.into()) {
        Some(pos) => pos.to_sheet_pos(sheet_pos.sheet_id),
        None if table_cache
            .single_cell_tables
            .get(sheet_pos.into())
            .is_some() =>
        {
            sheet_pos
        }
        _ => return None,
    };

    context.table_map.table_at(table_pos)
}

/// Determine whether there is a chart at a given position.
pub fn chart_at(
    sheet_pos: SheetPos,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> Option<Rect> {
    let table = table_at(sheet_pos, table_cache, context)?;
    if table.is_html_image {
        Some(table.bounds)
    } else {
        None
    }
}
