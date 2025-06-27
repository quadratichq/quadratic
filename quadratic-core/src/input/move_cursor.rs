//! Moves the cursor one cell in the given direction, accounting for charts.
//! (Eventually also accounting for sheet bounds to the right and bottom.)

use crate::{
    Pos, SheetPos,
    a1::A1Context,
    grid::{js_types::Direction, sheet::data_tables::cache::SheetDataTablesCache},
    input::has_content::{chart_at, table_header_at},
};

/// Returns a new Pos after pressing an arrow key.
pub fn move_cursor(
    pos: SheetPos,
    direction: Direction,
    table_cache: &SheetDataTablesCache,
    context: &A1Context,
) -> Pos {
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
                Pos {
                    x: chart_bounds.min.x - 1,
                    y: pos.y,
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
            move_cursor(pos, Direction::Right, sheet_data_tables_cache, context),
            Pos { x: 3, y: 2 }
        );
        assert_eq!(
            move_cursor(pos, Direction::Left, sheet_data_tables_cache, context),
            Pos { x: 1, y: 2 }
        );
        assert_eq!(
            move_cursor(pos, Direction::Up, sheet_data_tables_cache, context),
            Pos { x: 2, y: 1 }
        );
        assert_eq!(
            move_cursor(pos, Direction::Down, sheet_data_tables_cache, context),
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
                context
            ),
            Pos { x: 1, y: 2 }
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!2, 2],
                Direction::Up,
                sheet_data_tables_cache,
                context
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
                context
            ),
            pos![C3]
        );

        // Test moving right from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Right,
                sheet_data_tables_cache,
                context
            ),
            pos![E3]
        );

        // Test moving left from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!E3],
                Direction::Left,
                sheet_data_tables_cache,
                context
            ),
            pos![D3]
        );

        // Test moving down into chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D2],
                Direction::Down,
                sheet_data_tables_cache,
                context
            ),
            pos![D3]
        );

        // Test moving down from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Down,
                sheet_data_tables_cache,
                context
            ),
            pos![D6]
        );

        // Test moving up into chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D6],
                Direction::Up,
                sheet_data_tables_cache,
                context
            ),
            pos![D5]
        );

        // Test moving up from chart
        assert_eq!(
            move_cursor(
                pos![sheet_id!D5],
                Direction::Up,
                sheet_data_tables_cache,
                context
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
                context
            ),
            pos![C3]
        );

        // move right past header
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Right,
                sheet_data_tables_cache,
                context
            ),
            pos![E3]
        );

        // move left into header
        assert_eq!(
            move_cursor(
                pos![sheet_id!E3],
                Direction::Left,
                sheet_data_tables_cache,
                context
            ),
            pos![D3]
        );

        // move left past header
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Left,
                sheet_data_tables_cache,
                context
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
                context
            ),
            pos![C3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Right,
                sheet_data_tables_cache,
                context
            ),
            pos![D3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Right,
                sheet_data_tables_cache,
                context
            ),
            pos![E3]
        );

        // move left with no name
        assert_eq!(
            move_cursor(
                pos![sheet_id!E3],
                Direction::Left,
                sheet_data_tables_cache,
                context
            ),
            pos![D3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!D3],
                Direction::Left,
                sheet_data_tables_cache,
                context
            ),
            pos![C3]
        );
        assert_eq!(
            move_cursor(
                pos![sheet_id!C3],
                Direction::Left,
                sheet_data_tables_cache,
                context
            ),
            pos![B3]
        );
    }
}
