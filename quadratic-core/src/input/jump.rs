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

// #[cfg(test)]
// mod tests {
//     use crate::{
//         CellValue,
//         grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind},
//     };

//     use super::*;

//     // creates a 3x3 chart at the given position
//     fn create_3x3_chart(sheet: &mut Sheet, pos: Pos) {
//         let mut dt = DataTable::new(
//             DataTableKind::CodeRun(CodeRun {
//                 language: CodeCellLanguage::Javascript,
//                 ..Default::default()
//             }),
//             "Table 1",
//             CellValue::Html("<html></html>".to_string()).into(),
//             false,
//             Some(false),
//             Some(false),
//             None,
//         );
//         dt.chart_output = Some((3, 3));

//         sheet.set_cell_value(
//             pos,
//             CellValue::Code(CodeCellValue {
//                 code: "".to_string(),
//                 language: CodeCellLanguage::Javascript,
//             }),
//         );
//         sheet.set_data_table(pos, Some(dt));
//     }

//     #[test]
//     fn jump_right_empty() {
//         let sheet = Sheet::test();

//         let current = Pos { x: 1, y: 1 };
//         let new_pos = sheet.jump_right(current);
//         assert_eq!(new_pos, Pos { x: 2, y: 1 });

//         let current = Pos { x: 2, y: 2 };
//         let new_pos = sheet.jump_right(current);
//         assert_eq!(new_pos, Pos { x: 3, y: 2 });
//     }

//     #[test]
//     fn jump_right_filled() {
//         let mut sheet = Sheet::test();

//         sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 5, y: 1 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 10, y: 1 }, CellValue::Number(1.into()));

//         create_3x3_chart(&mut sheet, Pos { x: 20, y: 1 });
//         create_3x3_chart(&mut sheet, Pos { x: 25, y: 1 });

//         assert_eq!(sheet.jump_right(Pos { x: 0, y: 1 }), Pos { x: 1, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 1, y: 1 }), Pos { x: 5, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 5, y: 1 }), Pos { x: 10, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 10, y: 1 }), Pos { x: 20, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 20, y: 1 }), Pos { x: 25, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 21, y: 1 }), Pos { x: 25, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 21, y: 1 }), Pos { x: 25, y: 1 });
//     }

//     #[test]
//     fn jump_left_empty() {
//         let sheet = Sheet::test();

//         let current = Pos { x: 2, y: 1 };
//         let new_pos = sheet.jump_left(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 1 });

//         let current = Pos { x: 5, y: 3 };
//         let new_pos = sheet.jump_left(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 3 });
//     }

//     #[test]
//     fn jump_left_filled() {
//         let mut sheet = Sheet::test();

//         sheet.set_cell_value(Pos { x: 2, y: 1 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 5, y: 1 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 10, y: 1 }, CellValue::Number(1.into()));

//         create_3x3_chart(&mut sheet, Pos { x: 20, y: 1 });
//         create_3x3_chart(&mut sheet, Pos { x: 25, y: 1 });

//         assert_eq!(sheet.jump_left(Pos { x: 11, y: 1 }), Pos { x: 10, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 10, y: 1 }), Pos { x: 5, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 5, y: 1 }), Pos { x: 2, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 2, y: 1 }), Pos { x: 1, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 28, y: 1 }), Pos { x: 27, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 25, y: 1 }), Pos { x: 22, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 2, y: 1 }), Pos { x: 1, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 1, y: 1 }), Pos { x: 1, y: 1 });
//     }

//     #[test]
//     fn jump_left_chart() {
//         let mut sheet = Sheet::test();

//         create_3x3_chart(&mut sheet, Pos { x: 5, y: 1 });

//         assert_eq!(sheet.jump_left(Pos { x: 10, y: 2 }), Pos { x: 7, y: 2 });
//     }

//     #[test]
//     fn jump_up_empty() {
//         let sheet = Sheet::test();

//         let current = Pos { x: 1, y: 2 };
//         let new_pos = sheet.jump_up(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 1 });

//         let current = Pos { x: 1, y: 5 };
//         let new_pos = sheet.jump_up(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 1 });
//     }

//     #[test]
//     fn jump_up_filled() {
//         let mut sheet = Sheet::test();

//         sheet.set_cell_value(Pos { x: 3, y: 5 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 3, y: 10 }, CellValue::Number(1.into()));

//         create_3x3_chart(&mut sheet, Pos { x: 3, y: 20 });
//         create_3x3_chart(&mut sheet, Pos { x: 3, y: 25 });

//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 30 }), Pos { x: 3, y: 28 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 28 }), Pos { x: 3, y: 23 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 24 }), Pos { x: 3, y: 23 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 22 }), Pos { x: 3, y: 10 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 12 }), Pos { x: 3, y: 10 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 10 }), Pos { x: 3, y: 5 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 9 }), Pos { x: 3, y: 5 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 3 }), Pos { x: 3, y: 1 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 2 }), Pos { x: 3, y: 1 });
//     }

//     #[test]
//     fn jump_up_chart() {
//         let mut sheet = Sheet::test();

//         create_3x3_chart(&mut sheet, Pos { x: 5, y: 1 });

//         assert_eq!(sheet.jump_up(Pos { x: 6, y: 5 }), Pos { x: 6, y: 4 });
//     }

//     #[test]
//     fn jump_down_empty() {
//         let sheet = Sheet::test();

//         let current = Pos { x: 1, y: 1 };
//         let new_pos = sheet.jump_down(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 2 });

//         let current = Pos { x: 1, y: 5 };
//         let new_pos = sheet.jump_down(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 6 });
//     }

//     #[test]
//     fn test_jump_down_filled() {
//         let mut sheet = Sheet::test();

//         sheet.set_cell_value(Pos { x: 3, y: 5 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 3, y: 10 }, CellValue::Number(1.into()));

//         create_3x3_chart(&mut sheet, Pos { x: 3, y: 20 });
//         create_3x3_chart(&mut sheet, Pos { x: 3, y: 25 });

//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 1 }), Pos { x: 3, y: 5 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 5 }), Pos { x: 3, y: 10 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 6 }), Pos { x: 3, y: 10 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 10 }), Pos { x: 3, y: 20 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 15 }), Pos { x: 3, y: 20 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 13 }), Pos { x: 3, y: 20 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 20 }), Pos { x: 3, y: 25 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 23 }), Pos { x: 3, y: 25 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 26 }), Pos { x: 3, y: 29 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 26 }), Pos { x: 3, y: 29 });
//     }

//     #[test]
//     fn jump_with_consecutive_filled_cells() {
//         let mut sheet = Sheet::test();

//         // Create vertical sequence of filled cells
//         sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Number(2.into()));
//         sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Number(3.into()));

//         // Test jumping down through consecutive filled cells
//         let current = Pos { x: 1, y: 1 };
//         let new_pos = sheet.jump_down(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 3 });

//         // Test jumping up through consecutive filled cells
//         let current = Pos { x: 1, y: 3 };
//         let new_pos = sheet.jump_up(current);
//         assert_eq!(new_pos, Pos { x: 1, y: 1 });

//         // Create horizontal sequence of filled cells
//         sheet.set_cell_value(Pos { x: 5, y: 5 }, CellValue::Number(1.into()));
//         sheet.set_cell_value(Pos { x: 6, y: 5 }, CellValue::Number(2.into()));
//         sheet.set_cell_value(Pos { x: 7, y: 5 }, CellValue::Number(3.into()));

//         // Test jumping right through consecutive filled cells
//         let current = Pos { x: 5, y: 5 };
//         let new_pos = sheet.jump_right(current);
//         assert_eq!(new_pos, Pos { x: 7, y: 5 });

//         // Test jumping left through consecutive filled cells
//         let current = Pos { x: 7, y: 5 };
//         let new_pos = sheet.jump_left(current);
//         assert_eq!(new_pos, Pos { x: 5, y: 5 });
//     }

//     #[test]
//     fn test_jump_chart_on_edge() {
//         let mut sheet = Sheet::test();

//         create_3x3_chart(&mut sheet, Pos { x: 1, y: 1 });

//         assert_eq!(sheet.jump_left(Pos { x: 5, y: 1 }), Pos { x: 3, y: 1 });
//         assert_eq!(sheet.jump_left(Pos { x: 2, y: 1 }), Pos { x: 1, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 1, y: 1 }), Pos { x: 4, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 2, y: 1 }), Pos { x: 4, y: 1 });
//         assert_eq!(sheet.jump_right(Pos { x: 3, y: 1 }), Pos { x: 4, y: 1 });
//         assert_eq!(sheet.jump_up(Pos { x: 1, y: 5 }), Pos { x: 1, y: 4 });
//         assert_eq!(sheet.jump_up(Pos { x: 2, y: 5 }), Pos { x: 2, y: 4 });
//         assert_eq!(sheet.jump_up(Pos { x: 3, y: 4 }), Pos { x: 3, y: 1 });
//         assert_eq!(sheet.jump_down(Pos { x: 1, y: 1 }), Pos { x: 1, y: 5 });
//         assert_eq!(sheet.jump_down(Pos { x: 2, y: 2 }), Pos { x: 2, y: 5 });
//         assert_eq!(sheet.jump_down(Pos { x: 3, y: 4 }), Pos { x: 3, y: 5 });
//     }

//     #[test]
//     fn test_jump_right_simple_table() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "3", "4", "5"], false);

//         assert_eq!(sheet.jump_right(pos![A2]), pos![B2]);
//         assert_eq!(sheet.jump_right(pos![B2]), pos![F2]);
//         assert_eq!(sheet.jump_right(pos![C2]), pos![F2]);
//         assert_eq!(sheet.jump_right(pos![F2]), pos![G2]);
//     }

//     #[test]
//     fn test_jump_right_simple_table_with_blanks() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "", "", "5", "6"], false);

//         assert_eq!(sheet.jump_right(pos![A2]), pos![B2]);
//         assert_eq!(sheet.jump_right(pos![B2]), pos![C2]);
//         assert_eq!(sheet.jump_right(pos![C2]), pos![F2]);
//         assert_eq!(sheet.jump_right(pos![G2]), pos![H2]);
//         assert_eq!(sheet.jump_right(pos![F2]), pos![G2]);
//     }

//     #[test]
//     fn test_jump_left_simple_table() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "3", "4", "5"], false);

//         assert_eq!(sheet.jump_left(pos![G2]), pos![F2]);
//         assert_eq!(sheet.jump_left(pos![F2]), pos![B2]);
//         assert_eq!(sheet.jump_left(pos![D2]), pos![B2]);
//         assert_eq!(sheet.jump_left(pos![B2]), pos![A2]);
//     }

//     #[test]
//     fn test_jump_left_simple_table_with_blanks() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "", "", "5", "6"], false);

//         assert_eq!(sheet.jump_left(pos![H2]), pos![G2]);
//         assert_eq!(sheet.jump_left(pos![G2]), pos![F2]);
//         assert_eq!(sheet.jump_left(pos![F2]), pos![C2]);
//         assert_eq!(sheet.jump_left(pos![C2]), pos![B2]);
//         assert_eq!(sheet.jump_left(pos![B2]), pos![A2]);
//     }

//     #[test]
//     fn test_jump_down_simple_table() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "3", "4", "5"], true);

//         assert_eq!(sheet.jump_down(pos![B1]), pos![B2]);
//         assert_eq!(sheet.jump_down(pos![B2]), pos![B6]);
//         assert_eq!(sheet.jump_down(pos![B4]), pos![B6]);
//         assert_eq!(sheet.jump_down(pos![B6]), pos![B7]);
//     }

//     #[test]
//     fn test_jump_down_simple_table_with_blanks() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "", "", "5", "6"], true);

//         assert_eq!(sheet.jump_down(pos![B1]), pos![B2]);
//         assert_eq!(sheet.jump_down(pos![B2]), pos![B3]);
//         assert_eq!(sheet.jump_down(pos![B3]), pos![B6]);
//         assert_eq!(sheet.jump_down(pos![B7]), pos![B8]);
//         assert_eq!(sheet.jump_down(pos![B6]), pos![B7]);
//     }

//     #[test]
//     fn test_jump_up_simple_table() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "3", "4", "5"], true);

//         assert_eq!(sheet.jump_up(pos![B7]), pos![B6]);
//         assert_eq!(sheet.jump_up(pos![B6]), pos![B2]);
//         assert_eq!(sheet.jump_up(pos![B4]), pos![B2]);
//         assert_eq!(sheet.jump_up(pos![B2]), pos![B1]);
//     }

//     #[test]
//     fn test_jump_up_simple_table_with_blanks() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "", "", "5", "6"], true);

//         assert_eq!(sheet.jump_up(pos![B8]), pos![B7]);
//         assert_eq!(sheet.jump_up(pos![B7]), pos![B6]);
//         assert_eq!(sheet.jump_up(pos![B6]), pos![B3]);
//         assert_eq!(sheet.jump_up(pos![B3]), pos![B2]);
//         assert_eq!(sheet.jump_up(pos![B2]), pos![B1]);
//     }

//     #[test]
//     fn test_jump_left_table_from_name() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_code_run_array(2, 2, vec!["1", "2", "3"], false);

//         sheet
//             .modify_data_table_at(&pos![B2], |dt| {
//                 dt.show_name = Some(true);
//                 dt.show_columns = Some(true);
//                 Ok(())
//             })
//             .unwrap();

//         assert_eq!(sheet.jump_left(pos![D2]), pos![A2]);
//     }
// }
