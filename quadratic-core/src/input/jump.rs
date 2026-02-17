//! Handles the logic for jumping between cells (ctrl/cmd + arrow key).
//!
//! Algorithm:
//! - if on an empty cell then select to the first cell with a value
//! - if on a filled cell then select to the cell before the next empty cell
//! - if on a filled cell but the next cell is empty then select to the first
//!   cell with a value
//! - if there are no more cells then select the next cell over (excel selects
//!   to the end of the sheet; we don't have an end (yet) so right now I select
//!   one cell over)
//!
//! The above checks are always made relative to the original cursor position
//! (the highlighted cell)

use crate::{
    Pos, SheetPos,
    a1::A1Context,
    grid::{
        js_types::Direction,
        sheet::{data_tables::cache::SheetDataTablesCache, merge_cells::MergeCells},
    },
    input::{
        has_content::{chart_at, has_content_ignore_blank_table_with_merge, table_header_at},
        traverse::{find_next_column, find_next_row},
    },
    wasm_bindings::sheet_content_cache::SheetContentCache,
};

/// Returns the SheetPos after a jump (ctrl/cmd + arrow key)
pub fn jump_cursor(
    current: SheetPos,
    direction: Direction,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Pos {
    match direction {
        Direction::Up => jump_up(current, content_cache, table_cache, context, merge_cells),
        Direction::Down => jump_down(current, content_cache, table_cache, context, merge_cells),
        Direction::Left => jump_left(current, content_cache, table_cache, context, merge_cells),
        Direction::Right => jump_right(current, content_cache, table_cache, context, merge_cells),
    }
}

fn jump_up(
    current: SheetPos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Pos {
    let sheet_id = current.sheet_id;
    let mut y = current.y;
    let x = current.x;

    // if we're close to the edge, return the edge
    if y <= 2 {
        return Pos { x, y: 1 };
    }

    // adjust the jump position if it is inside a merged cell to the top-most
    // edge of the merged cell
    if let Some(merge_rect) = merge_cells.and_then(|mc| mc.get_merge_cell_rect(current.into())) {
        y = merge_rect.min.y;
    }
    // adjust the jump position if it is inside a chart to the top-most
    // edge of the chart
    else if let Some(chart_rect) = chart_at(current, table_cache, context) {
        y = chart_rect.min.y;
    }

    let prev_y: i64;

    // handle case of cell with content
    if has_content_ignore_blank_table_with_merge(
        Pos { x, y },
        content_cache,
        table_cache,
        merge_cells,
    ) {
        // if previous cell is empty, find the next cell with content
        if y - 1 == 0 {
            return Pos { x, y: 1 };
        }

        // if prev cell is empty, find the next cell with content
        if !has_content_ignore_blank_table_with_merge(
            Pos { x, y: y - 1 },
            content_cache,
            table_cache,
            merge_cells,
        ) {
            if let Some(prev) = find_next_row(
                sheet_id,
                y - 2,
                x,
                true,
                true,
                content_cache,
                table_cache,
                context,
                merge_cells,
            ) {
                prev_y = prev;
            } else {
                prev_y = 1;
            }
        }
        // if prev cell is not empty, find the next empty cell
        else if let Some(prev) = find_next_row(
            sheet_id,
            y - 2,
            x,
            true,
            false,
            content_cache,
            table_cache,
            context,
            merge_cells,
        ) {
            prev_y = prev + 1;
        } else {
            prev_y = y - 1;
        }
    }
    // otherwise find the next cell with content
    else {
        // this is wrong: the table is being excluded where it's starting from (y - 1 instead of y)
        if let Some(prev) = find_next_row(
            sheet_id,
            y - 1,
            x,
            true,
            true,
            content_cache,
            table_cache,
            context,
            merge_cells,
        ) {
            prev_y = prev;
        } else {
            prev_y = 1;
        }
    }

    Pos { x, y: prev_y }
}

fn jump_down(
    current: SheetPos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Pos {
    let mut y = current.y;
    let x = current.x;
    let sheet_id = current.sheet_id;

    // adjust the jump position if it is inside a merged cell to the bottom-most
    // edge of the merged cell
    if let Some(merge_rect) = merge_cells.and_then(|mc| mc.get_merge_cell_rect(current.into())) {
        y = merge_rect.max.y;
    }
    // adjust the jump position if it is inside a chart to the bottom-most
    // edge of the chart
    else if let Some(chart_rect) = chart_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        y = chart_rect.max.y;
    }

    let mut next_y: Option<i64> = None;

    // handle case of cell with content
    if has_content_ignore_blank_table_with_merge(
        Pos { x, y },
        content_cache,
        table_cache,
        merge_cells,
    ) {
        // if next cell is empty, find the next cell with content
        if !has_content_ignore_blank_table_with_merge(
            Pos { x, y: y + 1 },
            content_cache,
            table_cache,
            merge_cells,
        ) {
            if let Some(next) = find_next_row(
                sheet_id,
                y + 2,
                x,
                false,
                true,
                content_cache,
                table_cache,
                context,
                merge_cells,
            ) {
                next_y = Some(next);
            }
        }
        // if next cell is not empty, find the next empty cell
        else if let Some(next) = find_next_row(
            sheet_id,
            y + 2,
            x,
            false,
            false,
            content_cache,
            table_cache,
            context,
            merge_cells,
        ) {
            next_y = Some(next - 1);
        } else {
            next_y = Some(y + 1);
        }
    }
    // otherwise find the next cell with content
    else if let Some(next) = find_next_row(
        sheet_id,
        y + 1,
        x,
        false,
        true,
        content_cache,
        table_cache,
        context,
        merge_cells,
    ) {
        next_y = Some(next);
    }

    y = if let Some(next_y) = next_y {
        next_y
    } else {
        y + 1
    };

    Pos { x, y }
}

fn jump_left(
    current: SheetPos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Pos {
    let mut x = current.x;
    let y = current.y;
    let sheet_id = current.sheet_id;

    // if we're close to the edge, return the edge
    if x <= 2 {
        return Pos { x: 1, y };
    }

    // adjust the jump position if it is inside a merged cell to the left-most
    // edge of the merged cell
    if let Some(merge_rect) = merge_cells.and_then(|mc| mc.get_merge_cell_rect(current.into())) {
        x = merge_rect.min.x;
    }
    // adjust the jump position if it is inside a chart to the left-most
    // edge of the chart
    else if let Some(chart_rect) = chart_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = chart_rect.min.x;
    }
    // adjust the jump position if it is inside a table header to the left-most
    // edge of the table header
    if let Some(dt_rect) = table_header_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = dt_rect.min.x;
    }

    let prev_x;

    // handle case of cell with content
    if has_content_ignore_blank_table_with_merge(
        Pos { x, y },
        content_cache,
        table_cache,
        merge_cells,
    ) {
        // if previous cell is empty, find the next cell with content
        if x - 1 == 0 {
            return Pos { x: 1, y };
        }
        if !has_content_ignore_blank_table_with_merge(
            Pos { x: x - 1, y },
            content_cache,
            table_cache,
            merge_cells,
        ) {
            if x - 2 == 0 {
                return Pos { x: 1, y };
            }
            if let Some(prev) = find_next_column(
                sheet_id,
                x - 2,
                y,
                true,
                true,
                content_cache,
                table_cache,
                context,
                merge_cells,
            ) {
                prev_x = prev;
            } else {
                prev_x = 1;
            }
        }
        // if next cell is not empty, find the next empty cell
        else if let Some(prev) = find_next_column(
            sheet_id,
            x - 1,
            y,
            true,
            false,
            content_cache,
            table_cache,
            context,
            merge_cells,
        ) {
            prev_x = prev + 1;
        } else {
            prev_x = x - 1;
        }
    }
    // otherwise find the previous cell with content
    else if let Some(prev) = find_next_column(
        sheet_id,
        x - 1,
        y,
        true,
        true,
        content_cache,
        table_cache,
        context,
        merge_cells,
    ) {
        prev_x = prev;
    } else {
        prev_x = 1;
    }

    Pos { x: prev_x, y }
}

pub fn jump_right(
    current: SheetPos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Pos {
    let mut x = current.x;
    let y = current.y;
    let sheet_id = current.sheet_id;

    // adjust the jump position if it is inside a merged cell to the right-most
    // edge of the merged cell
    if let Some(merge_rect) = merge_cells.and_then(|mc| mc.get_merge_cell_rect(current.into())) {
        x = merge_rect.max.x;
    }
    // adjust the jump position if it is inside a chart or a table header to
    // the right-most edge
    else if let Some(dt_rect) = table_header_at(SheetPos { x, y, sheet_id }, table_cache, context)
    {
        x = dt_rect.max.x;
    } else if let Some(chart_rect) = chart_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = chart_rect.max.x;
    }

    // handle case of cell with content
    let mut next_x: Option<i64> = None;
    if has_content_ignore_blank_table_with_merge(
        Pos { x, y },
        content_cache,
        table_cache,
        merge_cells,
    ) {
        // if next cell is empty, find the next cell with content
        if !has_content_ignore_blank_table_with_merge(
            Pos { x: x + 1, y },
            content_cache,
            table_cache,
            merge_cells,
        ) {
            if let Some(next) = find_next_column(
                sheet_id,
                x + 2,
                y,
                false,
                true,
                content_cache,
                table_cache,
                context,
                merge_cells,
            ) {
                next_x = Some(next);
            }
        }
        // if next cell is not empty, find the next empty cell
        else if let Some(next) = find_next_column(
            sheet_id,
            x + 2,
            y,
            false,
            false,
            content_cache,
            table_cache,
            context,
            merge_cells,
        ) {
            next_x = Some(next - 1);
        } else {
            next_x = Some(x + 1);
        }
    }
    // otherwise find the next cell with content
    else if let Some(next) = find_next_column(
        sheet_id,
        x + 1,
        y,
        false,
        true,
        content_cache,
        table_cache,
        context,
        merge_cells,
    ) {
        next_x = Some(next);
    }

    x = if let Some(next_x) = next_x {
        next_x
    } else {
        x + 1
    };

    Pos { x, y }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::GridController, grid::CodeCellLanguage, input::has_content::row_bounds,
        test_util::*,
    };

    use super::*;

    #[track_caller]
    fn assert_jump_left(gc: &GridController, current: SheetPos, expected: Pos) {
        let sheet_id = current.sheet_id;
        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();
        let merge_cells = Some(&sheet.merge_cells);

        let new_pos = jump_left(
            current,
            &content_cache,
            sheet_data_tables_cache,
            &context,
            merge_cells,
        );
        assert_eq!(new_pos, expected);
    }

    #[track_caller]
    fn assert_jump_right(gc: &GridController, current: SheetPos, expected: Pos) {
        let sheet_id = current.sheet_id;
        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();
        let merge_cells = Some(&sheet.merge_cells);

        let new_pos = jump_right(
            current,
            &content_cache,
            sheet_data_tables_cache,
            &context,
            merge_cells,
        );
        assert_eq!(new_pos, expected);
    }

    #[track_caller]
    fn assert_jump_up(gc: &GridController, current: SheetPos, expected: Pos) {
        let sheet_id = current.sheet_id;
        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();
        let merge_cells = Some(&sheet.merge_cells);

        let new_pos = jump_up(
            current,
            &content_cache,
            sheet_data_tables_cache,
            &context,
            merge_cells,
        );
        assert_eq!(new_pos, expected);
    }

    #[track_caller]
    fn assert_jump_down(gc: &GridController, current: SheetPos, expected: Pos) {
        let sheet_id = current.sheet_id;
        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();
        let merge_cells = Some(&sheet.merge_cells);

        let new_pos = jump_down(
            current,
            &content_cache,
            sheet_data_tables_cache,
            &context,
            merge_cells,
        );
        assert_eq!(new_pos, expected);
    }

    #[test]
    fn test_jump_right_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        assert_jump_right(&gc, pos![sheet_id!A1], pos![B1]);
        assert_jump_right(&gc, pos![sheet_id!B2], pos![C2]);
    }

    #[test]
    fn test_jump_right_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!1, 1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!5, 1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!10, 1], "1".into(), None, false);

        test_create_html_chart(&mut gc, sheet_id, pos![10, 1], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![20, 1], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![25, 1], 3, 3);

        assert_jump_right(&gc, pos![sheet_id!0, 1], pos![1, 1]);
        assert_jump_right(&gc, pos![sheet_id!1, 1], pos![5, 1]);
        assert_jump_right(&gc, pos![sheet_id!5, 1], pos![10, 1]);
        assert_jump_right(&gc, pos![sheet_id!10, 1], pos![20, 1]);
        assert_jump_right(&gc, pos![sheet_id!20, 1], pos![25, 1]);
        assert_jump_right(&gc, pos![sheet_id!21, 1], pos![25, 1]);
    }

    #[test]
    fn test_jump_left_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        assert_jump_left(&gc, pos![sheet_id!2, 1], pos![1, 1]);
        assert_jump_left(&gc, pos![sheet_id!5, 3], pos![1, 3]);
    }

    #[test]
    fn test_jump_left_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!2, 1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!5, 1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!10, 1], "1".into(), None, false);

        test_create_html_chart(&mut gc, sheet_id, pos![20, 1], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![25, 1], 3, 3);

        assert_jump_left(&gc, pos![sheet_id!11, 1], pos![10, 1]);
        assert_jump_left(&gc, pos![sheet_id!10, 1], pos![5, 1]);
        assert_jump_left(&gc, pos![sheet_id!5, 1], pos![2, 1]);
        assert_jump_left(&gc, pos![sheet_id!2, 1], pos![1, 1]);
        assert_jump_left(&gc, pos![sheet_id!28, 1], pos![27, 1]);
        assert_jump_left(&gc, pos![sheet_id!25, 1], pos![22, 1]);
        assert_jump_left(&gc, pos![sheet_id!1, 1], pos![1, 1]);
    }

    #[test]
    fn test_jump_left_chart() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![5, 1], 3, 3);

        assert_jump_left(&gc, pos![sheet_id!10, 2], pos![7, 2]);
    }

    #[test]
    fn test_jump_up_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        assert_jump_up(&gc, pos![sheet_id!1, 2], pos![1, 1]);
        assert_jump_up(&gc, pos![sheet_id!1, 5], pos![1, 1]);
    }

    #[test]
    fn test_jump_up_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!3, 5], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!3, 10], "1".into(), None, false);

        test_create_html_chart(&mut gc, sheet_id, pos![3, 20], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![3, 25], 3, 3);

        assert_jump_up(&gc, pos![sheet_id!3, 30], pos![3, 28]);
        assert_jump_up(&gc, pos![sheet_id!3, 28], pos![3, 23]);
        assert_jump_up(&gc, pos![sheet_id!3, 24], pos![3, 23]);
        assert_jump_up(&gc, pos![sheet_id!3, 22], pos![3, 10]);
        assert_jump_up(&gc, pos![sheet_id!3, 12], pos![3, 10]);
        assert_jump_up(&gc, pos![sheet_id!3, 10], pos![3, 5]);
        assert_jump_up(&gc, pos![sheet_id!3, 9], pos![3, 5]);
        assert_jump_up(&gc, pos![sheet_id!3, 3], pos![3, 1]);
        assert_jump_up(&gc, pos![sheet_id!3, 2], pos![3, 1]);
    }

    #[test]
    fn test_jump_up_chart() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![5, 1], 3, 3);

        assert_jump_up(&gc, pos![sheet_id!6, 5], pos![6, 4]);
    }

    #[test]
    fn test_jump_down_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        assert_jump_down(&gc, pos![sheet_id!1, 1], pos![1, 2]);
        assert_jump_down(&gc, pos![sheet_id!1, 5], pos![1, 6]);
    }

    #[test]
    fn test_jump_down_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!3, 5], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!3, 10], "1".into(), None, false);

        test_create_html_chart(&mut gc, sheet_id, pos![3, 20], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![3, 25], 3, 3);

        assert_jump_down(&gc, pos![sheet_id!3, 1], pos![3, 5]);
        assert_jump_down(&gc, pos![sheet_id!3, 5], pos![3, 10]);
        assert_jump_down(&gc, pos![sheet_id!3, 6], pos![3, 10]);
        assert_jump_down(&gc, pos![sheet_id!3, 10], pos![3, 20]);
        assert_jump_down(&gc, pos![sheet_id!3, 15], pos![3, 20]);
        assert_jump_down(&gc, pos![sheet_id!3, 13], pos![3, 20]);
        assert_jump_down(&gc, pos![sheet_id!3, 20], pos![3, 25]);
        assert_jump_down(&gc, pos![sheet_id!3, 23], pos![3, 25]);
        assert_jump_down(&gc, pos![sheet_id!3, 26], pos![3, 29]);
    }

    #[test]
    fn test_jump_with_consecutive_filled_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create vertical sequence of filled cells
        gc.set_cell_value(pos![sheet_id!1, 1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!1, 2], "2".into(), None, false);
        gc.set_cell_value(pos![sheet_id!1, 3], "3".into(), None, false);

        assert_jump_down(&gc, pos![sheet_id!1, 1], pos![1, 3]);
        assert_jump_up(&gc, pos![sheet_id!1, 3], pos![1, 1]);

        // Create horizontal sequence of filled cells
        gc.set_cell_value(pos![sheet_id!5, 5], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!6, 5], "2".into(), None, false);
        gc.set_cell_value(pos![sheet_id!7, 5], "3".into(), None, false);

        assert_jump_right(&gc, pos![sheet_id!5, 5], pos![7, 5]);
        assert_jump_left(&gc, pos![sheet_id!7, 5], pos![5, 5]);
    }

    #[test]
    fn test_jump_chart_on_edge() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![1, 1], 3, 3);

        assert_jump_left(&gc, pos![sheet_id!5, 1], pos![3, 1]);
        assert_jump_left(&gc, pos![sheet_id!2, 1], pos![1, 1]);
        assert_jump_right(&gc, pos![sheet_id!1, 1], pos![4, 1]);
        assert_jump_right(&gc, pos![sheet_id!2, 1], pos![4, 1]);
        assert_jump_right(&gc, pos![sheet_id!3, 1], pos![4, 1]);
        assert_jump_up(&gc, pos![sheet_id!1, 5], pos![1, 4]);
        assert_jump_up(&gc, pos![sheet_id!2, 5], pos![2, 4]);
        assert_jump_up(&gc, pos![sheet_id!3, 4], pos![3, 1]);
        assert_jump_down(&gc, pos![sheet_id!1, 1], pos![1, 5]);
        assert_jump_down(&gc, pos![sheet_id!2, 2], pos![2, 5]);
        assert_jump_down(&gc, pos![sheet_id!3, 4], pos![3, 5]);
    }

    #[test]
    fn test_jump_right_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table(&mut gc, sheet_id, pos![2, 2], 5, 1);

        assert_jump_right(&gc, pos![sheet_id!A2], pos![B2]);
        assert_jump_right(&gc, pos![sheet_id!B2], pos![F2]);
        assert_jump_right(&gc, pos![sheet_id!C2], pos![F2]);
        assert_jump_right(&gc, pos![sheet_id!F2], pos![G2]);
    }

    #[test]
    fn test_jump_right_simple_table_with_blanks() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table_with_values(
            &mut gc,
            sheet_id,
            pos![2, 2],
            5,
            1,
            &["1", "2", "", "", "5", "6"],
        );

        assert_jump_right(&gc, pos![sheet_id!A2], pos![B2]);
        assert_jump_right(&gc, pos![sheet_id!B2], pos![C2]);
        assert_jump_right(&gc, pos![sheet_id!C2], pos![F2]);
        assert_jump_right(&gc, pos![sheet_id!G2], pos![H2]);
        assert_jump_right(&gc, pos![sheet_id!F2], pos![G2]);
    }

    #[test]
    fn test_jump_left_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table(&mut gc, sheet_id, pos![2, 2], 5, 1);

        assert_jump_left(&gc, pos![sheet_id!G2], pos![F2]);
        assert_jump_left(&gc, pos![sheet_id!F2], pos![B2]);
        assert_jump_left(&gc, pos![sheet_id!D2], pos![B2]);
        assert_jump_left(&gc, pos![sheet_id!B2], pos![A2]);
    }

    #[test]
    fn test_jump_left_simple_table_with_blanks() {
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

        assert_jump_left(&gc, pos![sheet_id!H2], pos![G2]);
        assert_jump_left(&gc, pos![sheet_id!G2], pos![F2]);
        assert_jump_left(&gc, pos![sheet_id!F2], pos![C2]);
        assert_jump_left(&gc, pos![sheet_id!C2], pos![B2]);
        assert_jump_left(&gc, pos![sheet_id!B2], pos![A2]);
    }

    #[test]
    fn test_jump_down_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table(&mut gc, sheet_id, pos![2, 2], 1, 5);

        assert_jump_down(&gc, pos![sheet_id!B1], pos![B2]);
        assert_jump_down(&gc, pos![sheet_id!B2], pos![B6]);
        assert_jump_down(&gc, pos![sheet_id!B4], pos![B6]);
        assert_jump_down(&gc, pos![sheet_id!B6], pos![B7]);
    }

    #[test]
    fn test_jump_down_simple_table_with_blanks() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table_with_values(
            &mut gc,
            sheet_id,
            pos![2, 2],
            1,
            6,
            &["1", "2", "", "", "5", "6"],
        );

        assert_jump_down(&gc, pos![sheet_id!B1], pos![B2]);
        assert_jump_down(&gc, pos![sheet_id!B2], pos![B3]);
        assert_jump_down(&gc, pos![sheet_id!B3], pos![B6]);
        assert_jump_down(&gc, pos![sheet_id!B6], pos![B7]);
    }

    #[test]
    fn test_jump_up_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table(&mut gc, sheet_id, pos![2, 2], 1, 5);

        assert_jump_up(&gc, pos![sheet_id!B7], pos![B6]);
        assert_jump_up(&gc, pos![sheet_id!B6], pos![B2]);
        assert_jump_up(&gc, pos![sheet_id!B4], pos![B2]);
        assert_jump_up(&gc, pos![sheet_id!B2], pos![B1]);
    }

    #[test]
    fn test_jump_up_simple_table_with_blanks() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table_with_values(
            &mut gc,
            sheet_id,
            pos![2, 2],
            1,
            6,
            &["1", "2", "", "", "5", "6"],
        );

        assert_jump_up(&gc, pos![sheet_id!B8], pos![B7]);
        assert_jump_up(&gc, pos![sheet_id!B7], pos![B6]);
        assert_jump_up(&gc, pos![sheet_id!B6], pos![B3]);
        assert_jump_up(&gc, pos![sheet_id!B3], pos![B2]);
        assert_jump_up(&gc, pos![sheet_id!B2], pos![B1]);
    }

    #[test]
    fn test_jump_left_table_from_name() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![2, 2], 3, 1);

        assert_jump_left(&gc, pos![sheet_id!D2], pos![A2]);
    }

    #[test]
    fn test_jump_bug_with_table_and_formula() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        gc.set_code_cell(
            pos![sheet_id!E3],
            CodeCellLanguage::Formula,
            "A1".into(),
            None,
            None,
            false,
        );

        print_first_sheet(&gc);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let table_cache = sheet.data_tables.cache_ref();
        assert_eq!(
            row_bounds(3, &content_cache, table_cache, None),
            Some((1, 5))
        );

        assert_jump_left(&gc, pos![sheet_id!F3], pos![E3]);
        assert_jump_left(&gc, pos![sheet_id!E3], pos![C3]);
        assert_jump_left(&gc, pos![sheet_id!C3], pos![A3]);
    }

    #[test]
    fn test_jump_with_merged_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Merge cells B2:D4 (3x3 merged cell)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("B2:D4"),
            None,
            false,
        );

        // Set some content around the merged cell
        gc.set_cell_value(pos![sheet_id!B1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B5], "2".into(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "3".into(), None, false);
        gc.set_cell_value(pos![sheet_id!E2], "4".into(), None, false);

        // Test jumping up from inside merged cell - should jump from top edge
        // Column is maintained (C), so C3 -> C1
        assert_jump_up(&gc, pos![sheet_id!C3], pos![C1]);
        assert_jump_up(&gc, pos![sheet_id!D4], pos![D1]); // Should maintain column D

        // Test jumping down from inside merged cell - should jump from bottom edge
        assert_jump_down(&gc, pos![sheet_id!B2], pos![B5]);
        assert_jump_down(&gc, pos![sheet_id!C3], pos![C5]); // Should maintain column C

        // Test jumping left from inside merged cell - should jump from left edge
        assert_jump_left(&gc, pos![sheet_id!C3], pos![A3]);
        assert_jump_left(&gc, pos![sheet_id!D4], pos![A4]); // Should maintain row 4

        // Test jumping right from inside merged cell - should jump from right edge
        assert_jump_right(&gc, pos![sheet_id!B2], pos![E2]);
        assert_jump_right(&gc, pos![sheet_id!C3], pos![E3]); // Should maintain row 3
    }
}
