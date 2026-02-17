//! Moves the cursor one cell in the given direction, accounting for charts.
//! (Eventually also accounting for sheet bounds to the right and bottom.)

use crate::{
    Pos, SheetPos,
    a1::A1Context,
    grid::{
        js_types::Direction,
        sheet::{data_tables::cache::SheetDataTablesCache, merge_cells::MergeCells},
    },
    input::has_content::{chart_at, table_header_at},
};

/// Returns a new Pos after pressing an arrow key.
pub fn move_cursor(
    pos: SheetPos,
    direction: Direction,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
    merge_cells: Option<&MergeCells>,
) -> Pos {
    // Check if we're anywhere in a merged cell
    let merge_cell_bounds = merge_cells.and_then(|mc| mc.get_merge_cell_rect(pos.into()));

    match direction {
        Direction::Up => {
            if pos.y == 1 {
                pos.into()
            } else if let Some(chart_bounds) = chart_at(pos, table_cache, context) {
                if chart_bounds.min.y == 1 {
                    pos.into()
                } else {
                    Pos {
                        x: pos.x,
                        y: chart_bounds.min.y - 1,
                    }
                }
            } else if let Some(merge_rect) = merge_cell_bounds {
                // Skip to the cell above the merged cell, maintaining the current column
                if merge_rect.min.y == 1 {
                    pos.into()
                } else {
                    Pos {
                        x: pos.x,
                        y: merge_rect.min.y - 1,
                    }
                }
            } else {
                Pos {
                    x: pos.x,
                    y: pos.y - 1,
                }
            }
        }
        Direction::Down => {
            if let Some(chart_bounds) = chart_at(pos, table_cache, context) {
                Pos {
                    x: pos.x,
                    y: chart_bounds.max.y + 1,
                }
            } else if let Some(merge_rect) = merge_cell_bounds {
                // Skip to the cell below the merged cell, maintaining the current column
                Pos {
                    x: pos.x,
                    y: merge_rect.max.y + 1,
                }
            } else {
                Pos {
                    x: pos.x,
                    y: pos.y + 1,
                }
            }
        }
        Direction::Left => {
            if pos.x == 1 {
                pos.into()
            } else if let Some(chart_bounds) = chart_at(pos, table_cache, context) {
                if chart_bounds.min.x == 1 {
                    pos.into()
                } else {
                    Pos {
                        x: chart_bounds.min.x - 1,
                        y: pos.y,
                    }
                }
            } else if let Some(table_bounds) = table_header_at(pos, table_cache, context) {
                Pos {
                    x: if table_bounds.min.x == 1 {
                        1
                    } else {
                        table_bounds.min.x - 1
                    },
                    y: pos.y,
                }
            } else if let Some(merge_rect) = merge_cell_bounds {
                // Skip to the cell to the left of the merged cell
                if merge_rect.min.x == 1 {
                    pos.into()
                } else {
                    Pos {
                        x: merge_rect.min.x - 1,
                        y: pos.y,
                    }
                }
            } else {
                Pos {
                    x: pos.x - 1,
                    y: pos.y,
                }
            }
        }
        Direction::Right => {
            if let Some(chart_bounds) = chart_at(pos, table_cache, context) {
                Pos {
                    x: chart_bounds.max.x + 1,
                    y: pos.y,
                }
            } else if let Some(table_bounds) = table_header_at(pos, table_cache, context) {
                Pos {
                    x: table_bounds.max.x + 1,
                    y: pos.y,
                }
            } else if let Some(merge_rect) = merge_cell_bounds {
                // Skip to the cell to the right of the merged cell
                Pos {
                    x: merge_rect.max.x + 1,
                    y: pos.y,
                }
            } else {
                Pos {
                    x: pos.x + 1,
                    y: pos.y,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::*;

    #[test]
    fn test_basic_movements() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        let pos = pos![sheet_id!2, 2];
        assert_eq!(
            move_cursor(
                pos,
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            Pos { x: 3, y: 2 }
        );
        assert_eq!(
            move_cursor(pos, Direction::Left, sheet_data_tables_cache, context, None),
            Pos { x: 1, y: 2 }
        );
        assert_eq!(
            move_cursor(pos, Direction::Up, sheet_data_tables_cache, context, None),
            Pos { x: 2, y: 1 }
        );
        assert_eq!(
            move_cursor(pos, Direction::Down, sheet_data_tables_cache, context, None),
            Pos { x: 2, y: 3 }
        );
    }

    #[test]
    fn test_boundary_conditions() {
        let gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        assert_eq!(
            move_cursor(
                pos![sheet_id!2, 2],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            Pos { x: 1, y: 2 }
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!2, 2],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                None
            ),
            Pos { x: 2, y: 1 }
        );
    }

    #[test]
    fn test_chart_navigation() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![3, 3], 2, 2);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        // Test moving right into chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!B3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![C3]
        );

        // Test moving right from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![E3]
        );

        // Test moving left from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!E3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D3]
        );

        // Test moving down into chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D2],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D3]
        );

        // Test moving down from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D6]
        );

        // Test moving up into chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D6],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D5]
        );

        // Test moving up from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D5],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D2]
        );
    }

    #[test]
    fn test_table_header_navigation() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![3, 3], 2, 2);

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        // move right into header
        assert_eq!(
            move_cursor(
                pos![sheet_id!B3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![C3]
        );

        // move right past header
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![E3]
        );

        // move left into header
        assert_eq!(
            move_cursor(
                pos![sheet_id!E3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D3]
        );

        // move left past header
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![B3]
        );
    }

    #[test]
    fn test_table_header_navigation_no_ui() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table_no_ui(&mut gc, sheet_id, pos![C3], 2, 2);
        gc.data_table_meta(
            pos![sheet_id!C3],
            None,
            None,
            None,
            Some(Some(false)),
            Some(Some(false)),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();

        // move right with no name
        assert_eq!(
            move_cursor(
                pos![sheet_id!B3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![C3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![E3]
        );

        // move left with no name
        assert_eq!(
            move_cursor(
                pos![sheet_id!E3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![D3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![C3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                None
            ),
            pos![B3]
        );
    }

    #[test]
    fn test_merge_cell_navigation() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Merge cells B2:D4 (3x3 merged cell)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("B2:D4"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test moving up from anchor (top-left corner) - should go above merged cell, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![B1] // Should maintain current column (B)
        );

        // Test moving up from bottom-right of merged cell - should go above, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!D4],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![D1] // Should maintain current column (D)
        );

        // Test moving up from middle of merged cell - should go above, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![C1] // Should maintain current column (C)
        );

        // Test moving down from anchor - should go below merged cell, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![B5] // Should maintain current column (B)
        );

        // Test moving down from top-right of merged cell - should go below, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!D2],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![D5] // Should maintain current column (D)
        );

        // Test moving left from anchor - should go left of merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![A2]
        );

        // Test moving left from right side of merged cell - should go left, maintaining same row
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![A3] // Should maintain same row (3)
        );

        // Test moving right from anchor - should go right of merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![E2]
        );

        // Test moving right from left side of merged cell - should go right, maintaining same row
        assert_eq!(
            move_cursor(
                pos![sheet_id!B4],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![E4] // Should maintain same row (4)
        );
    }

    #[test]
    fn test_merge_cell_navigation_horizontal() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Merge cells B2:E2 (horizontal merged cell, 4 columns wide)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("B2:E2"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test moving up from middle of horizontal merged cell - should go above, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!C2],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![C1] // Should maintain current column (C)
        );

        // Test moving down from middle of horizontal merged cell - should go below, maintaining current column
        assert_eq!(
            move_cursor(
                pos![sheet_id!D2],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![D3] // Should maintain current column (D)
        );

        // Test moving left from right side - should go left of merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!E2],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![A2]
        );

        // Test moving right from left side - should go right of merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![F2]
        );
    }

    #[test]
    fn test_merge_cell_navigation_vertical() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Merge cells B2:B5 (vertical merged cell, 4 rows tall)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("B2:B5"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test moving up from bottom - should go above merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!B5],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![B1]
        );

        // Test moving down from top - should go below merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![B6]
        );

        // Test moving left from middle - should go left, maintaining same row
        assert_eq!(
            move_cursor(
                pos![sheet_id!B3],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![A3] // Should maintain same row (3)
        );

        // Test moving right from middle - should go right, maintaining same row
        assert_eq!(
            move_cursor(
                pos![sheet_id!B4],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![C4] // Should maintain same row (4)
        );
    }

    #[test]
    fn test_merge_cell_rightmost_column() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Merge cells B2:D4 (3x3 merged cell)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("B2:D4"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test that the rightmost column (D) is detected as part of the merged cell
        // Moving right from the rightmost column should skip past the merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3], // Rightmost column, middle row
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![E3] // Should skip to column E (right of merged cell)
        );

        // Test moving up from rightmost column - should exit above merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!D4], // Rightmost column, bottom row
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![D1] // Should maintain column D, go above merged cell
        );

        // Test moving down from rightmost column - should exit below merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!D2], // Rightmost column, top row
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![D5] // Should maintain column D, go below merged cell
        );
    }

    #[test]
    fn test_multiple_merge_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create first merged cell B2:C3
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("B2:C3"),
            None,
            false,
        );

        // Create second merged cell E5:F6
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("E5:F6"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test first merged cell (B2:C3) - moving right from B2
        assert_eq!(
            move_cursor(
                pos![sheet_id!B2],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![D2] // Should skip to D2
        );

        // Test second merged cell (E5:F6) - moving right from E5
        assert_eq!(
            move_cursor(
                pos![sheet_id!E5],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![G5] // Should skip to G5
        );

        // Test second merged cell (E5:F6) - moving down from E5
        assert_eq!(
            move_cursor(
                pos![sheet_id!E5],
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![E7] // Should skip to E7
        );

        // Test second merged cell (E5:F6) - moving from bottom right corner
        assert_eq!(
            move_cursor(
                pos![sheet_id!F6],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![G6] // Should skip to G6
        );
    }

    #[test]
    fn test_overlapping_axis_merge_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Create first merged cell D5:G13
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("D5:G13"),
            None,
            false,
        );

        // Create second merged cell G25:J37 (shares column G with first merged cell)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("G25:J37"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test first merged cell D5:G13 - left portion (D5:F12 should work)
        assert_eq!(
            move_cursor(
                pos![sheet_id!D5],
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![H5] // Should skip to H5 (right of first merged cell)
        );

        // Test first merged cell at column G (rightmost column of first merge)
        assert_eq!(
            move_cursor(
                pos![sheet_id!G10], // Column G, row 10 (within first merged cell)
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![H10] // Should skip to H10 (right of first merged cell)
        );

        // Test second merged cell G25:J37 - at column G
        assert_eq!(
            move_cursor(
                pos![sheet_id!G30], // Column G, row 30 (within second merged cell)
                Direction::Right,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![K30] // Should skip to K30 (right of second merged cell)
        );

        // Test moving down from first merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!G5], // Top of first merged cell at column G
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![G14] // Should skip to G14 (below first merged cell)
        );

        // Test moving down from second merged cell
        assert_eq!(
            move_cursor(
                pos![sheet_id!G25], // Top of second merged cell at column G
                Direction::Down,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![G38] // Should skip to G38 (below second merged cell)
        );
    }

    #[test]
    fn test_merge_cell_at_boundary() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Merge cells A1:C3 (starts at column 1 and row 1)
        gc.merge_cells(
            crate::a1::A1Selection::test_a1("A1:C3"),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let sheet_data_tables_cache = sheet.data_tables.cache_ref();
        let context = gc.a1_context();
        let merge_cells = Some(&sheet.merge_cells);

        // Test moving left from within a merged cell starting at column 1
        // Should stay in place (return same position), not go to column 0
        assert_eq!(
            move_cursor(
                pos![sheet_id!C2], // Right side of merge at column A
                Direction::Left,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![C2] // Should stay in place since merge starts at column 1
        );

        // Test moving up from within a merged cell starting at row 1
        // Should stay in place (return same position), not go to row 0
        assert_eq!(
            move_cursor(
                pos![sheet_id!B3], // Bottom of merge at row 1
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![B3] // Should stay in place since merge starts at row 1
        );

        // Test moving left from anchor of merge at column 1
        assert_eq!(
            move_cursor(
                pos![sheet_id!A1],
                Direction::Left,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![A1] // Should stay at A1
        );

        // Test moving up from anchor of merge at row 1
        assert_eq!(
            move_cursor(
                pos![sheet_id!A1],
                Direction::Up,
                sheet_data_tables_cache,
                context,
                merge_cells
            ),
            pos![A1] // Should stay at A1
        );
    }
}
