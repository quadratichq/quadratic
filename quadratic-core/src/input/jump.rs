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
    grid::sheet::data_tables::cache::SheetDataTablesCache,
    input::{
        Direction,
        has_content::{chart_at, has_content_ignore_blank_table, table_header_at},
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
) -> Pos {
    match direction {
        Direction::Up => jump_up(current, content_cache, table_cache, context),
        Direction::Down => jump_down(current, content_cache, table_cache, context),
        Direction::Left => jump_left(current, content_cache, table_cache, context),
        Direction::Right => jump_right(current, content_cache, table_cache, context),
    }
}

fn jump_up(
    current: SheetPos,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> Pos {
    let sheet_id = current.sheet_id;
    let mut y = current.y;
    let x = current.x;

    // if we're close to the edge, return the edge
    if y <= 2 {
        return Pos { x, y: 1 };
    }

    // adjust the jump position if it is inside a chart to the top-most
    // edge of the chart
    if let Some(chart_rect) = chart_at(current, table_cache, context) {
        y = chart_rect.min.y;
    }

    let prev_y: i64;

    // handle case of cell with content
    if has_content_ignore_blank_table(
        Pos { x, y }.to_sheet_pos(sheet_id),
        content_cache,
        table_cache,
    ) {
        // if previous cell is empty, find the next cell with content
        if y - 1 == 0 {
            return Pos { x, y: 1 };
        }

        // if prev cell is empty, find the next cell with content
        if !has_content_ignore_blank_table(
            Pos { x, y: y - 1 }.to_sheet_pos(sheet_id),
            content_cache,
            table_cache,
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
) -> Pos {
    let mut y = current.y;
    let x = current.x;
    let sheet_id = current.sheet_id;

    // adjust the jump position if it is inside a chart to the bottom-most
    // edge of the chart
    if let Some(chart_rect) = chart_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        y = chart_rect.max.y;
    }

    let mut next_y: Option<i64> = None;

    // handle case of cell with content
    if has_content_ignore_blank_table(SheetPos { x, y, sheet_id }, content_cache, table_cache) {
        // if next cell is empty, find the next cell with content
        if !has_content_ignore_blank_table(
            SheetPos {
                x,
                y: y + 1,
                sheet_id,
            },
            content_cache,
            table_cache,
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
) -> Pos {
    let mut x = current.x;
    let y = current.y;
    let sheet_id = current.sheet_id;

    // if we're close to the edge, return the edge
    if x <= 2 {
        return Pos { x: 1, y };
    }

    // adjust the jump position if it is inside a chart to the left-most
    // edge of the chart
    if let Some(chart_rect) = chart_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = chart_rect.min.x;
    }
    // adjust the jump position if it is inside a table header to the left-most
    // edge of the table header
    if let Some(dt_rect) = table_header_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = dt_rect.min.x;
    }

    let prev_x;

    // handle case of cell with content
    if has_content_ignore_blank_table(SheetPos { x, y, sheet_id }, content_cache, table_cache) {
        // if previous cell is empty, find the next cell with content
        if x - 1 == 0 {
            return Pos { x: 1, y };
        }
        if !has_content_ignore_blank_table(
            SheetPos {
                x: x - 1,
                y,
                sheet_id,
            },
            content_cache,
            table_cache,
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
) -> Pos {
    let mut x = current.x;
    let y = current.y;
    let sheet_id = current.sheet_id;

    // adjust the jump position if it is inside a chart or a table header to
    // the right-most edge
    if let Some(dt_rect) = table_header_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = dt_rect.max.x;
    } else if let Some(chart_rect) = chart_at(SheetPos { x, y, sheet_id }, table_cache, context) {
        x = chart_rect.max.x;
    }

    // handle case of cell with content
    let mut next_x: Option<i64> = None;
    if has_content_ignore_blank_table(SheetPos { x, y, sheet_id }, content_cache, table_cache) {
        // if next cell is empty, find the next cell with content
        if !has_content_ignore_blank_table(
            SheetPos {
                x: x + 1,
                y,
                sheet_id,
            },
            content_cache,
            table_cache,
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
    use crate::test_util::*;

    use super::*;

    #[test]
    fn jump_right_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let context = gc.a1_context().clone();

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        let new_pos = jump_right(
            pos![sheet_id!A1],
            &content_cache,
            &sheet_data_tables_cache,
            &context,
        );
        assert_eq!(new_pos, pos![B1]);

        let new_pos = jump_right(
            pos![sheet_id!B2],
            &content_cache,
            &sheet_data_tables_cache,
            &context,
        );
        assert_eq!(new_pos, pos![C2]);
    }

    #[test]
    fn jump_right_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!1, 1], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!5, 1], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!10, 1], "1".into(), None);

        test_create_html_chart(&mut gc, sheet_id, pos![10, 1], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![20, 1], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![25, 1], 3, 3);

        let content_cache = gc.sheet(sheet_id).content_cache();
        let sheet_data_tables_cache = gc.sheet(sheet_id).data_tables.cache_ref();
        let context = gc.a1_context();

        assert_eq!(
            jump_right(
                pos![sheet_id!0, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!1, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![5, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!5, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![10, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!10, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![20, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!20, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![25, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!21, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![25, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!21, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![25, 1]
        );
    }

    #[test]
    fn jump_left_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let context = gc.a1_context().clone();

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        let current = pos![sheet_id!2, 1];
        let new_pos = jump_left(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, Pos { x: 1, y: 1 });

        let current = pos![sheet_id!5, 3];
        let new_pos = jump_left(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![1, 3]);
    }

    #[test]
    fn jump_left_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!2, 1], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!5, 1], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!10, 1], "1".into(), None);

        test_create_html_chart(&mut gc, sheet_id, pos![20, 1], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![25, 1], 3, 3);

        let context = gc.a1_context().clone();
        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        assert_eq!(
            jump_left(
                pos![sheet_id!11, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![10, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!10, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![5, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!5, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![2, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!2, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!28, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![27, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!25, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![22, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!2, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!1, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 1]
        );
    }

    #[test]
    fn jump_left_chart() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![5, 1], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_left(
                pos![sheet_id!10, 2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![7, 2]
        );
    }

    #[test]
    fn jump_up_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let context = gc.a1_context().clone();

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        let current = pos![sheet_id!1, 2];
        let new_pos = jump_up(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, Pos { x: 1, y: 1 });

        let current = pos![sheet_id!1, 5];
        let new_pos = jump_up(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, Pos { x: 1, y: 1 });
    }

    #[test]
    fn jump_up_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!3, 5], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!3, 10], "1".into(), None);

        test_create_html_chart(&mut gc, sheet_id, pos![3, 20], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![3, 25], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_up(
                pos![sheet_id!3, 30],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 28]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 28],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 23]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 24],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 23]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 22],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 10]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 12],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 10]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 10],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 5]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 9],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 5]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 3],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 1]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 1]
        );
    }

    #[test]
    fn jump_up_chart() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![5, 1], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_up(
                pos![sheet_id!6, 5],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![6, 4]
        );
    }

    #[test]
    fn jump_down_empty() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let context = gc.a1_context().clone();

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();

        let current = pos![sheet_id!1, 1];
        let new_pos = jump_down(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![1, 2]);

        let current = pos![sheet_id!1, 5];
        let new_pos = jump_down(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![1, 6]);
    }

    #[test]
    fn test_jump_down_filled() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!3, 5], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!3, 10], "1".into(), None);

        test_create_html_chart(&mut gc, sheet_id, pos![3, 20], 3, 3);
        test_create_html_chart(&mut gc, sheet_id, pos![3, 25], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_down(
                pos![sheet_id!3, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 5]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 5],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 10]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 6],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 10]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 10],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 20]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 15],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 20]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 13],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 20]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 20],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 25]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 23],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 25]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 26],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 29]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 26],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 29]
        );
    }

    #[test]
    fn jump_with_consecutive_filled_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create vertical sequence of filled cells
        gc.set_cell_value(pos![sheet_id!1, 1], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!1, 2], "2".into(), None);
        gc.set_cell_value(pos![sheet_id!1, 3], "3".into(), None);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        // Test jumping down through consecutive filled cells
        let current = pos![sheet_id!1, 1];
        let new_pos = jump_down(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![1, 3]);

        // Test jumping up through consecutive filled cells
        let current = pos![sheet_id!1, 3];
        let new_pos = jump_up(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![1, 1]);

        // Create horizontal sequence of filled cells
        gc.set_cell_value(pos![sheet_id!5, 5], "1".into(), None);
        gc.set_cell_value(pos![sheet_id!6, 5], "2".into(), None);
        gc.set_cell_value(pos![sheet_id!7, 5], "3".into(), None);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        // Test jumping right through consecutive filled cells
        let current = pos![sheet_id!5, 5];
        let new_pos = jump_right(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![7, 5]);

        // Test jumping left through consecutive filled cells
        let current = pos![sheet_id!7, 5];
        let new_pos = jump_left(current, &content_cache, &sheet_data_tables_cache, &context);
        assert_eq!(new_pos, pos![5, 5]);
    }

    #[test]
    fn test_jump_chart_on_edge() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![1, 1], 3, 3);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_left(
                pos![sheet_id!5, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 1]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!2, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!1, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![4, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!2, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![4, 1]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!3, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![4, 1]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!1, 5],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 4]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!2, 5],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![2, 4]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!3, 4],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 1]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!1, 1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![1, 5]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!2, 2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![2, 5]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!3, 4],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![3, 5]
        );
    }

    #[test]
    fn test_jump_right_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![2, 2], 5, 1);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_right(
                pos![sheet_id!A2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![F2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!C2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![F2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!F2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![G2]
        );
    }

    #[test]
    fn test_jump_right_simple_table_with_blanks() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![2, 2],
            5,
            1,
            &["1", "2", "", "", "5", "6"],
        );

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_right(
                pos![sheet_id!A2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![C2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!C2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![F2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!G2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![H2]
        );
        assert_eq!(
            jump_right(
                pos![sheet_id!F2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![G2]
        );
    }

    #[test]
    fn test_jump_left_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![2, 2], 5, 1);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_left(
                pos![sheet_id!G2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![F2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!F2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!D2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![A2]
        );
    }

    #[test]
    fn test_jump_left_simple_table_with_blanks() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![2, 2],
            5,
            1,
            &["1", "2", "", "", "5", "6"],
        );

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_left(
                pos![sheet_id!H2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![G2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!G2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![F2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!F2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![C2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!C2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_left(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![A2]
        );
    }

    #[test]
    fn test_jump_down_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![2, 2], 5, 1);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_down(
                pos![sheet_id!B1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B6]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B4],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B6]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B6],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B7]
        );
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

        print_first_sheet(&gc);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_down(
                pos![sheet_id!B1],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B3]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B3],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B6]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B7],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B8]
        );
        assert_eq!(
            jump_down(
                pos![sheet_id!B6],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B7]
        );
    }

    #[test]
    fn test_jump_up_simple_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![2, 2], 5, 1);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_up(
                pos![sheet_id!B7],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B6]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B6],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B4],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B1]
        );
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

        print_first_sheet(&gc);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_up(
                pos![sheet_id!B8],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B7]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B7],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B6]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B6],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B3]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B3],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B2]
        );
        assert_eq!(
            jump_up(
                pos![sheet_id!B2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![B1]
        );
    }

    #[test]
    fn test_jump_left_table_from_name() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![2, 2], 3, 1);

        let sheet = gc.sheet(sheet_id);
        let content_cache = sheet.content_cache();
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context().clone();

        assert_eq!(
            jump_left(
                pos![sheet_id!D2],
                &content_cache,
                &sheet_data_tables_cache,
                &context
            ),
            pos![A2]
        );
    }
}
