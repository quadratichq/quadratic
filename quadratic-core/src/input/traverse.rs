use crate::{
    Pos, SheetPos,
    a1::A1Context,
    grid::{
        SheetId,
        sheet::{data_tables::cache::SheetDataTablesCache, merge_cells::MergeCells},
    },
    input::has_content::{
        column_bounds, has_content_ignore_blank_table_with_merge, is_at_table_edge_col,
        is_at_table_edge_row, row_bounds,
    },
    wasm_bindings::sheet_content_cache::SheetContentCache,
};

/// finds the nearest column with or without content
/// if reverse is true it searches to the left of the start
/// if with_content is true it searches for a column with content; otherwise it searches for a column without content
///
/// For charts, is uses the chart's bounds for intersection test (since charts are considered a single cell)
///
/// Returns the found column matching the criteria of with_content
#[allow(clippy::too_many_arguments)]
pub(crate) fn find_next_column(
    sheet_id: SheetId,
    column_start: i64,
    row: i64,
    reverse: bool,
    with_content: bool,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Option<i64> {
    let Some(bounds) = row_bounds(row, content_cache, table_cache, merge_cells) else {
        return if with_content {
            None
        } else {
            Some(column_start)
        };
    };
    let mut x = column_start;
    let mut at_table_edge = false;
    while (reverse && x >= bounds.0) || (!reverse && x <= bounds.1) {
        let has_content = has_content_ignore_blank_table_with_merge(
            Pos { x, y: row },
            content_cache,
            table_cache,
            merge_cells,
        );

        // add edges of data tables to the search
        at_table_edge = is_at_table_edge_col(
            SheetPos {
                x,
                y: row,
                sheet_id,
            },
            table_cache,
            context,
        );

        if at_table_edge {
            return Some(
                x + if with_content {
                    0
                } else if reverse {
                    -1
                } else {
                    1
                },
            );
        }

        if has_content {
            if with_content {
                return Some(x);
            }
        } else if !with_content {
            return Some(x);
        }
        x += if reverse { -1 } else { 1 };
    }

    // final check when we've exited the loop
    let has_content = has_content_ignore_blank_table_with_merge(
        Pos { x, y: row },
        content_cache,
        table_cache,
        merge_cells,
    ) || at_table_edge;
    if with_content == has_content {
        Some(x)
    } else {
        None
    }
}

/// finds the next column with or without content if reverse is true it
/// searches to the left of the start if with_content is true it searches
/// for a column with content; otherwise it searches for a column without
/// content
///
/// Returns the found row matching the criteria of with_content
#[allow(clippy::too_many_arguments)]
pub(crate) fn find_next_row(
    sheet_id: SheetId,
    row_start: i64,
    column: i64,
    reverse: bool,
    with_content: bool,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Option<i64> {
    let Some(bounds) = column_bounds(column, content_cache, table_cache, merge_cells) else {
        return if with_content { None } else { Some(row_start) };
    };
    let mut y = row_start;
    let mut at_table_edge = false;
    while (reverse && y >= bounds.0) || (!reverse && y <= bounds.1) {
        let has_content = has_content_ignore_blank_table_with_merge(
            Pos { x: column, y },
            content_cache,
            table_cache,
            merge_cells,
        );

        // add edges of data tables to the search
        at_table_edge = is_at_table_edge_row(
            SheetPos {
                x: column,
                y,
                sheet_id,
            },
            table_cache,
            context,
        );

        if at_table_edge {
            return Some(
                y + if with_content {
                    0
                } else if reverse {
                    -1
                } else {
                    1
                },
            );
        }

        if (has_content && with_content) || (!has_content && !with_content) {
            return Some(y);
        }

        y += if reverse { -1 } else { 1 };
    }

    // final check when we've exited the loop
    let has_content = has_content_ignore_blank_table_with_merge(
        Pos { x: column, y },
        content_cache,
        table_cache,
        merge_cells,
    ) || at_table_edge;
    if with_content == has_content {
        Some(y)
    } else {
        None
    }
}
