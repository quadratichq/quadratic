//! Helper functions for getting data from the caches.

use crate::a1::{A1Context, TableMapEntry};
use crate::grid::sheet::data_tables::cache::SheetDataTablesCache;
use crate::grid::sheet::merge_cells::MergeCells;
use crate::wasm_bindings::sheet_content_cache::SheetContentCache;
use crate::{Pos, Rect, SheetPos};

/// Gets the Table that intersects a given position.
pub fn table_at<'a>(
    sheet_pos: SheetPos,
    table_cache: &SheetDataTablesCache,
    context: &'a A1Context,
) -> Option<&'a TableMapEntry> {
    let table_pos = table_cache
        .get_pos_contains(sheet_pos.into())?
        .to_sheet_pos(sheet_pos.sheet_id);

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

/// Returns the bounds of the table header at a given position.
pub fn table_header_at(
    sheet_pos: SheetPos,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> Option<Rect> {
    let table = table_at(sheet_pos, table_cache, context)?;
    if table.show_name && sheet_pos.y == table.bounds.min.y {
        Some(table.bounds)
    } else {
        None
    }
}

/// Returns true if the cell is at the horizontal edge of a table.
pub(crate) fn is_at_table_edge_col(
    sheet_pos: SheetPos,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> bool {
    if let Some(table) = table_at(sheet_pos, table_cache, context) {
        if table.bounds.width() == 1 {
            return false;
        }
        table.bounds.min.x == sheet_pos.x || table.bounds.max.x == sheet_pos.x
    } else {
        false
    }
}

/// Returns true if the cell is at the vertical edge of a table.
pub(crate) fn is_at_table_edge_row(
    sheet_pos: SheetPos,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> bool {
    if let Some(table) = table_at(sheet_pos, table_cache, context) {
        // we handle charts separately in find_next_*;
        // we ignore single_value tables
        if table.bounds.height() == 1 {
            return false;
        }
        if table.bounds.min.y == sheet_pos.y {
            // table name, or column header if no table name, or top of data if no column header or table name
            return true;
        }

        let show_name = table.show_name;
        let show_columns = table.show_columns;

        if table.bounds.min.y + (if show_name { 1 } else { 0 }) + (if show_columns { 1 } else { 0 })
            == sheet_pos.y
        {
            // ignore column header--just go to first line of data or table name
            return true;
        } else if table.bounds.max.y == sheet_pos.y {
            return true;
        }
    }
    false
}

/// Uses the caches to return the bounds of the row or None if the row is empty
/// of content.
pub(crate) fn row_bounds(
    row: i64,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    merge_cells: Option<&MergeCells>,
) -> Option<(i64, i64)> {
    let content_row_bounds = content_cache.row_bounds(row);
    let table_row_bounds = table_cache.row_bounds(row);

    let mut min_col = None;
    let mut max_col = None;

    if let (Some(content_row_bounds), Some(table_row_bounds)) =
        (content_row_bounds, table_row_bounds)
    {
        min_col = Some(content_row_bounds.0.min(table_row_bounds.0));
        max_col = Some(content_row_bounds.1.max(table_row_bounds.1));
    } else if let Some(content_row_bounds) = content_row_bounds {
        min_col = Some(content_row_bounds.0);
        max_col = Some(content_row_bounds.1);
    } else if let Some(table_row_bounds) = table_row_bounds {
        min_col = Some(table_row_bounds.0);
        max_col = Some(table_row_bounds.1);
    }

    // Expand bounds to include merged cells that have content
    if let Some(merge_cells) = merge_cells {
        // Iterate over all merge cells and filter to those that intersect this row
        for merge_rect in merge_cells.iter_merge_cells() {
            // Skip if this merge cell doesn't intersect the row
            if merge_rect.min.y > row || merge_rect.max.y < row {
                continue;
            }
            // Check if the anchor cell has content
            if content_cache.has_content_at_pos(merge_rect.min) {
                // Expand bounds to include the merged cell's column range
                if let Some(ref mut min) = min_col {
                    *min = (*min).min(merge_rect.min.x);
                } else {
                    min_col = Some(merge_rect.min.x);
                }
                if let Some(ref mut max) = max_col {
                    *max = (*max).max(merge_rect.max.x);
                } else {
                    max_col = Some(merge_rect.max.x);
                }
            }
        }
    }

    match (min_col, max_col) {
        (Some(min), Some(max)) => Some((min, max)),
        _ => None,
    }
}

/// Uses the caches to return the bounds of the column or None if the column is
/// empty of content.
pub(crate) fn column_bounds(
    column: i64,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    merge_cells: Option<&MergeCells>,
) -> Option<(i64, i64)> {
    let content_column_bounds = content_cache.column_bounds(column);
    let table_column_bounds = table_cache.column_bounds(column);

    let mut min_row = None;
    let mut max_row = None;

    if let (Some(content_column_bounds), Some(table_column_bounds)) =
        (content_column_bounds, table_column_bounds)
    {
        min_row = Some(content_column_bounds.0.min(table_column_bounds.0));
        max_row = Some(content_column_bounds.1.max(table_column_bounds.1));
    } else if let Some(content_column_bounds) = content_column_bounds {
        min_row = Some(content_column_bounds.0);
        max_row = Some(content_column_bounds.1);
    } else if let Some(table_column_bounds) = table_column_bounds {
        min_row = Some(table_column_bounds.0);
        max_row = Some(table_column_bounds.1);
    }

    // Expand bounds to include merged cells that have content
    if let Some(merge_cells) = merge_cells {
        // Iterate over all merge cells and filter to those that intersect this column
        for merge_rect in merge_cells.iter_merge_cells() {
            // Skip if this merge cell doesn't intersect the column
            if merge_rect.min.x > column || merge_rect.max.x < column {
                continue;
            }
            // Check if the anchor cell has content
            if content_cache.has_content_at_pos(merge_rect.min) {
                // Expand bounds to include the merged cell's row range
                if let Some(ref mut min) = min_row {
                    *min = (*min).min(merge_rect.min.y);
                } else {
                    min_row = Some(merge_rect.min.y);
                }
                if let Some(ref mut max) = max_row {
                    *max = (*max).max(merge_rect.max.y);
                } else {
                    max_row = Some(merge_rect.max.y);
                }
            }
        }
    }

    match (min_row, max_row) {
        (Some(min), Some(max)) => Some((min, max)),
        _ => None,
    }
}

/// Returns true if the cell has content (either on the sheet or in a table).
pub(crate) fn has_content_ignore_blank_table(
    pos: Pos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
) -> bool {
    if content_cache.has_content_at_pos(pos) {
        return true;
    }

    table_cache.has_content_ignore_blank_table(pos)
}

/// Returns true if the cell has content, accounting for merged cells.
/// If the position is in a merged cell, checks the anchor cell (top-left) for content.
pub(crate) fn has_content_ignore_blank_table_with_merge(
    pos: Pos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    merge_cells: Option<&MergeCells>,
) -> bool {
    // If we're in a merged cell, check the anchor cell for content
    if let Some(merge_cells) = merge_cells
        && let Some(merge_cell) = merge_cells.get_merge_cell_rect(pos)
    {
        return content_cache.has_content_at_pos(merge_cell.min);
    }

    has_content_ignore_blank_table(pos, content_cache, table_cache)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{grid::CodeCellLanguage, test_util::*};

    #[test]
    fn test_has_content_ignore_blank_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!1, 1], "1".into(), None, false);
        test_create_data_table_with_values(&mut gc, sheet_id, pos![2, 2], 3, 1, &["1", "", "3"]);

        let sheet = gc.sheet(sheet_id);

        // normal content
        assert!(has_content_ignore_blank_table(
            pos![1, 1],
            &sheet.content_cache(),
            sheet.data_tables.cache_ref()
        ));
        assert!(!has_content_ignore_blank_table(
            pos![2, 1],
            &sheet.content_cache(),
            sheet.data_tables.cache_ref()
        ));

        // table content
        assert!(has_content_ignore_blank_table(
            pos![2, 4],
            &sheet.content_cache(),
            sheet.data_tables.cache_ref()
        ));
        assert!(!has_content_ignore_blank_table(
            pos![3, 4],
            &sheet.content_cache(),
            sheet.data_tables.cache_ref()
        ));
    }

    #[test]
    fn test_bounds() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);
        gc.set_code_cell(
            pos![sheet_id!D1],
            CodeCellLanguage::Formula,
            "A1".into(),
            None,
            None,
            false,
        );
        gc.set_cell_value(pos![sheet_id!F1], "1".into(), None, false);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        assert_eq!(
            column_bounds(1, &sheet.content_cache(), sheet_data_tables_cache, None),
            Some((1, 4))
        );
        assert_eq!(
            column_bounds(4, &sheet.content_cache(), sheet_data_tables_cache, None),
            Some((1, 1))
        );
        assert_eq!(
            column_bounds(6, &sheet.content_cache(), sheet_data_tables_cache, None),
            Some((1, 1))
        );

        assert_eq!(
            row_bounds(1, &sheet.content_cache(), sheet_data_tables_cache, None),
            Some((1, 6))
        );
        assert_eq!(
            row_bounds(2, &sheet.content_cache(), sheet_data_tables_cache, None),
            Some((1, 2))
        );
    }
}
