//! Moves the cursor one cell in the given direction, accounting for charts.
//! (Eventually also accounting for sheet bounds to the right and bottom.)

use crate::{
    Pos, SheetPos,
    a1::A1Context,
    grid::sheet::data_tables::cache::SheetDataTablesCache,
    input::has_content::{chart_at, table_header_at},
};

use super::Direction;

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

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn test_basic_movements() {
//         let sheet = Sheet::test();
//         let pos = Pos { x: 2, y: 2 };

//         assert_eq!(sheet.move_cursor(pos, Direction::Right), Pos { x: 3, y: 2 });
//         assert_eq!(sheet.move_cursor(pos, Direction::Left), Pos { x: 1, y: 2 });
//         assert_eq!(sheet.move_cursor(pos, Direction::Up), Pos { x: 2, y: 1 });
//         assert_eq!(sheet.move_cursor(pos, Direction::Down), Pos { x: 2, y: 3 });
//     }

//     #[test]
//     fn test_boundary_conditions() {
//         let sheet = Sheet::test();
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 1, y: 2 }, Direction::Left),
//             Pos { x: 1, y: 2 }
//         );
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 2, y: 1 }, Direction::Up),
//             Pos { x: 2, y: 1 }
//         );
//     }

//     #[test]
//     fn test_chart_navigation() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_chart(Pos { x: 3, y: 3 }, 2, 2);

//         // Test moving right into chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 2, y: 3 }, Direction::Right),
//             Pos { x: 3, y: 3 }
//         );

//         // Test moving right from chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 3, y: 3 }, Direction::Right),
//             Pos { x: 5, y: 3 }
//         );

//         // Test moving left from chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 3, y: 3 }, Direction::Left),
//             Pos { x: 2, y: 3 }
//         );

//         // Test moving down into chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 3, y: 2 }, Direction::Down),
//             Pos { x: 3, y: 3 }
//         );

//         // Test moving down from chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 4, y: 3 }, Direction::Down),
//             Pos { x: 4, y: 6 }
//         );

//         // Test moving up into chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 3, y: 4 }, Direction::Up),
//             Pos { x: 3, y: 2 }
//         );

//         // Test moving up from chart
//         assert_eq!(
//             sheet.move_cursor(Pos { x: 4, y: 4 }, Direction::Up),
//             Pos { x: 4, y: 2 }
//         );
//     }

//     #[test]
//     fn test_table_header_navigation() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_data_table(pos![C3], 2, 2, false, Some(true), Some(true));

//         // move right into header
//         assert_eq!(sheet.move_cursor(pos![B3], Direction::Right), pos![C3]);

//         // move right past header
//         assert_eq!(sheet.move_cursor(pos![C3], Direction::Right), pos![E3]);

//         // move left into header
//         assert_eq!(sheet.move_cursor(pos![E3], Direction::Left), pos![D3]);

//         // move left past header
//         assert_eq!(sheet.move_cursor(pos![D3], Direction::Left), pos![B3]);

//         // move left past header
//         assert_eq!(sheet.move_cursor(pos![C3], Direction::Left), pos![B3]);
//     }

//     #[test]
//     fn test_table_header_navigation_no_name() {
//         let mut sheet = Sheet::test();
//         sheet.test_set_data_table(pos![C3], 2, 2, false, Some(false), Some(false));

//         // move right with no name
//         assert_eq!(sheet.move_cursor(pos![B3], Direction::Right), pos![C3]);
//         assert_eq!(sheet.move_cursor(pos![C3], Direction::Right), pos![D3]);
//         assert_eq!(sheet.move_cursor(pos![D3], Direction::Right), pos![E3]);

//         // move left with no name
//         assert_eq!(sheet.move_cursor(pos![E3], Direction::Left), pos![D3]);
//         assert_eq!(sheet.move_cursor(pos![D3], Direction::Left), pos![C3]);
//         assert_eq!(sheet.move_cursor(pos![C3], Direction::Left), pos![B3]);
//     }
// }
