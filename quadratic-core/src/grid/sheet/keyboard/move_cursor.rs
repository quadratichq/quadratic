//! Moves the cursor one cell in the given direction, accounting for charts.
//! (Eventually also accounting for sheet bounds to the right and bottom.)

use crate::{grid::Sheet, Pos};

use super::Direction;

impl Sheet {
    /// Returns a new Pos after pressing an arrow key.
    pub fn move_cursor(&self, pos: Pos, direction: Direction) -> Pos {
        match direction {
            Direction::Up => {
                if pos.y == 1 {
                    pos
                } else {
                    if let Some((chart_pos, _)) = self.chart_at(pos) {
                        if chart_pos.y == 1 {
                            pos
                        } else {
                            Pos {
                                x: pos.x,
                                y: chart_pos.y - 1,
                            }
                        }
                    } else {
                        Pos {
                            x: pos.x,
                            y: pos.y - 1,
                        }
                    }
                }
            }
            Direction::Down => {
                if let Some((chart_pos, dt)) = self.chart_at(pos) {
                    let output_size = dt.output_size();
                    Pos {
                        x: pos.x,
                        y: chart_pos.y + output_size.h.get() as i64,
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
                    pos
                } else {
                    if let Some((chart_pos, _)) = self.chart_at(pos) {
                        Pos {
                            x: chart_pos.x - 1,
                            y: pos.y,
                        }
                    } else {
                        Pos {
                            x: pos.x - 1,
                            y: pos.y,
                        }
                    }
                }
            }
            Direction::Right => {
                if let Some((chart_pos, dt)) = self.chart_at(pos) {
                    let output_size = dt.output_size();
                    Pos {
                        x: chart_pos.x + output_size.w.get() as i64,
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_movements() {
        let sheet = Sheet::test();
        let pos = Pos { x: 2, y: 2 };

        assert_eq!(sheet.move_cursor(pos, Direction::Right), Pos { x: 3, y: 2 });
        assert_eq!(sheet.move_cursor(pos, Direction::Left), Pos { x: 1, y: 2 });
        assert_eq!(sheet.move_cursor(pos, Direction::Up), Pos { x: 2, y: 1 });
        assert_eq!(sheet.move_cursor(pos, Direction::Down), Pos { x: 2, y: 3 });
    }

    #[test]
    fn test_boundary_conditions() {
        let sheet = Sheet::test();
        assert_eq!(
            sheet.move_cursor(Pos { x: 1, y: 2 }, Direction::Left),
            Pos { x: 1, y: 2 }
        );
        assert_eq!(
            sheet.move_cursor(Pos { x: 2, y: 1 }, Direction::Up),
            Pos { x: 2, y: 1 }
        );
    }

    #[test]
    fn test_chart_navigation() {
        let mut sheet = Sheet::test();
        sheet.test_set_chart(Pos { x: 3, y: 3 }, 2, 2);

        // Test moving right into chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 2, y: 3 }, Direction::Right),
            Pos { x: 3, y: 3 }
        );

        // Test moving right from chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 3, y: 3 }, Direction::Right),
            Pos { x: 5, y: 3 }
        );

        // Test moving left from chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 3, y: 3 }, Direction::Left),
            Pos { x: 2, y: 3 }
        );

        // Test moving down into chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 3, y: 2 }, Direction::Down),
            Pos { x: 3, y: 3 }
        );

        // Test moving down from chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 4, y: 3 }, Direction::Down),
            Pos { x: 4, y: 5 }
        );

        // Test moving up into chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 3, y: 4 }, Direction::Up),
            Pos { x: 3, y: 2 }
        );

        // Test moving up from chart
        assert_eq!(
            sheet.move_cursor(Pos { x: 4, y: 4 }, Direction::Up),
            Pos { x: 4, y: 2 }
        );
    }
}
