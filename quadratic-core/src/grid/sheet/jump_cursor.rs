//! Handles the logic for jumping between cells (ctrl/cmd + arrow key).
//!
//! Algorithm:
//! - if on an empty cell then select to the first cell with a value
//! - if on a filled cell then select to the cell before the next empty cell
//! - if on a filled cell but the next cell is empty then select to the first
//!   cell with a value
//! - if there are no more cells then select the next cell over (excel selects
//!   to the end of the sheet; we don’t have an end (yet) so right now I select
//!   one cell over)
//!
//! The above checks are always made relative to the original cursor position
//! (the highlighted cell)

// TODO: charts code is left intact and should be uncommented after merging with
// data tables.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::Pos;

use super::Sheet;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
pub enum JumpDirection {
    Up,
    Down,
    Left,
    Right,
}

impl Sheet {
    fn jump_up(&self, current: Pos) -> Pos {
        let mut y = current.y;
        let x = current.x;

        // if we're close to the edge, return the edge
        if y <= 2 {
            return Pos { x, y: 1 };
        }

        // adjust the jump position if it is inside a chart to the top-most
        // edge of the chart
        // if let Some((chart_pos, _)) = self.chart_at(Pos { x, y }) {
        //     y = chart_pos.y;
        // }

        let prev_y: Option<i64>;

        // handle case of cell with content
        if self.has_content(Pos { x, y }) {
            // if previous cell is empty, find the next cell with content
            if y - 1 == 0 {
                return Pos { x, y: 1 };
            }

            // if prev cell is empty, find the next cell with content
            if !self.has_content(Pos { x, y: y - 1 }) {
                if let Some(prev) = self.find_next_row(y - 2, x, true, true) {
                    prev_y = Some(prev);
                } else {
                    prev_y = Some(1);
                }
            }
            // if prev cell is not empty, find the next empty cell
            else if let Some(prev) = self.find_next_row(y - 2, x, true, false) {
                prev_y = Some(prev + 1);
            } else {
                prev_y = Some(y - 1);
            }
        }
        // otherwise find the next cell with content
        else {
            // this is wrong: the table is being excluded where it's starting from (y - 1 instead of y)
            if let Some(prev) = self.find_next_row(y - 1, x, true, true) {
                prev_y = Some(prev);
            } else {
                prev_y = Some(1);
            }
        }
        y = if let Some(prev_y) = prev_y {
            prev_y
        } else {
            (y - 1).max(1)
        };
        Pos { x, y }
    }

    fn jump_down(&self, current: Pos) -> Pos {
        let mut y = current.y;
        let x = current.x;

        // adjust the jump position if it is inside a chart to the bottom-most
        // edge of the chart
        // if let Some((chart_pos, dt)) = self.chart_at(Pos { x, y }) {
        //     if let Some((_, h)) = dt.chart_output {
        //         y = chart_pos.y + (h as i64) - 1;
        //     }
        // }

        let mut next_y: Option<i64> = None;

        // handle case of cell with content
        if self.has_content(Pos { x, y }) {
            // if next cell is empty, find the next cell with content
            if !self.has_content(Pos { x, y: y + 1 }) {
                if let Some(next) = self.find_next_row(y + 2, x, false, true) {
                    next_y = Some(next);
                }
            }
            // if next cell is not empty, find the next empty cell
            else if let Some(next) = self.find_next_row(y + 2, x, false, false) {
                next_y = Some(next - 1);
            } else {
                next_y = Some(y + 1);
            }
        }
        // otherwise find the next cell with content
        else if let Some(next) = self.find_next_row(y + 1, x, false, true) {
            next_y = Some(next);
        }

        y = if let Some(next_y) = next_y {
            next_y
        } else {
            y + 1
        };

        Pos { x, y }
    }

    fn jump_left(&self, current: Pos) -> Pos {
        let mut x = current.x;
        let y = current.y;

        // if we're close to the edge, return the edge
        if x <= 2 {
            return Pos { x: 1, y };
        }

        // adjust the jump position if it is inside a chart to the left-most
        // edge of the chart
        // if let Some((chart_pos, _)) = self.chart_at(Pos { x, y }) {
        //     x = chart_pos.x;
        // }

        let mut prev_x: Option<i64> = None;

        // handle case of cell with content
        if self.has_content(Pos { x, y }) {
            // if previous cell is empty, find the next cell with content
            if x - 1 == 0 {
                return Pos { x: 1, y };
            }
            if !self.has_content(Pos { x: x - 1, y }) {
                if x - 2 == 0 {
                    return Pos { x: 1, y };
                }
                if let Some(prev) = self.find_next_column(x - 2, y, true, true) {
                    prev_x = Some(prev);
                }
            }
            // if next cell is not empty, find the next empty cell
            else if let Some(prev) = self.find_next_column(x - 1, y, true, false) {
                prev_x = Some(prev + 1);
            } else {
                prev_x = Some(x - 1);
            }
        }
        // otherwise find the previous cell with content
        else if let Some(prev) = self.find_next_column(x - 1, y, true, true) {
            prev_x = Some(prev);
        } else {
            prev_x = Some(1);
        }

        x = if let Some(prev_x) = prev_x {
            prev_x
        } else {
            (x - 1).max(1)
        };

        Pos { x, y }
    }

    fn jump_right(&self, current: Pos) -> Pos {
        let mut x = current.x;
        let y = current.y;

        // adjust the jump position if it is inside a chart to the right-most
        // edge of the chart
        // if let Some((chart_pos, dt)) = self.chart_at(Pos { x, y }) {
        //     if let Some((w, _)) = dt.chart_output {
        //         x = chart_pos.x + (w as i64) - 1;
        //     }
        // }

        // handle case of cell with content
        let mut next_x: Option<i64> = None;
        if self.has_content(Pos { x, y }) {
            // if next cell is empty, find the next cell with content
            if !self.has_content(Pos { x: x + 1, y }) {
                if let Some(next) = self.find_next_column(x + 2, y, false, true) {
                    next_x = Some(next);
                }
            }
            // if next cell is not empty, find the next empty cell
            else if let Some(next) = self.find_next_column(x + 2, y, false, false) {
                next_x = Some(next - 1);
            } else {
                next_x = Some(x + 1);
            }
        }
        // otherwise find the next cell with content
        else if let Some(next) = self.find_next_column(x + 1, y, false, true) {
            next_x = Some(next);
        }

        x = if let Some(next_x) = next_x {
            next_x
        } else {
            x + 1
        };

        Pos { x, y }
    }

    /// Returns the Pos after a jump (ctrl/cmd + arrow key)
    pub fn jump_cursor(&self, current: Pos, direction: JumpDirection) -> Pos {
        match direction {
            JumpDirection::Up => self.jump_up(current),
            JumpDirection::Down => self.jump_down(current),
            JumpDirection::Left => self.jump_left(current),
            JumpDirection::Right => self.jump_right(current),
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::CellValue;

    use super::*;

    // // creates a 3x3 chart at the given position
    // fn create_3x3_chart(sheet: &mut Sheet, pos: Pos) {
    //     let mut dt = DataTable::new(
    //         DataTableKind::CodeRun(CodeRun::default()),
    //         "Table 1",
    //         CellValue::Html("<html></html>".to_string()).into(),
    //         false,
    //         false,
    //         false,
    //         None,
    //     );
    //     dt.chart_output = Some((3, 3));

    //     sheet.set_cell_value(
    //         pos,
    //         CellValue::Code(CodeCellValue {
    //             code: "".to_string(),
    //             language: CodeCellLanguage::Javascript,
    //         }),
    //     );
    //     sheet.set_data_table(pos, Some(dt));
    // }

    #[test]
    #[parallel]
    fn jump_right_empty() {
        let sheet = Sheet::test();

        let pos = Pos { x: 1, y: 1 };
        let new_pos = sheet.jump_right(pos);
        assert_eq!(new_pos, Pos { x: 2, y: 1 });
        let new_pos = sheet.jump_right(Pos { x: 2, y: 2 });
        assert_eq!(new_pos, Pos { x: 3, y: 2 });
    }

    #[test]
    #[parallel]
    fn jump_right_filled() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 5, y: 1 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 10, y: 1 }, CellValue::Number(1.into()));

        // create_3x3_chart(&mut sheet, Pos { x: 20, y: 1 });
        // create_3x3_chart(&mut sheet, Pos { x: 25, y: 1 });

        assert_eq!(sheet.jump_right(Pos { x: 0, y: 1 }), Pos { x: 1, y: 1 });
        assert_eq!(sheet.jump_right(Pos { x: 1, y: 1 }), Pos { x: 5, y: 1 });
        assert_eq!(sheet.jump_right(Pos { x: 5, y: 1 }), Pos { x: 10, y: 1 });

        // // jump to the first cell in the first chart
        // assert_eq!(sheet.jump_right(Pos { x: 10, y: 1 }), Pos { x: 20, y: 1 });

        // // jump to the first cell in the second chart
        // assert_eq!(sheet.jump_right(Pos { x: 20, y: 1 }), Pos { x: 25, y: 1 });
        // assert_eq!(sheet.jump_right(Pos { x: 21, y: 1 }), Pos { x: 25, y: 1 });
    }

    #[test]
    #[parallel]
    fn jump_left_empty() {
        let sheet = Sheet::test();

        let pos = Pos { x: 2, y: 1 };
        let new_pos = sheet.jump_left(pos);
        assert_eq!(new_pos, Pos { x: 1, y: 1 });
        let new_pos = sheet.jump_left(Pos { x: 5, y: 3 });
        assert_eq!(new_pos, Pos { x: 1, y: 3 });
    }

    #[test]
    #[parallel]
    fn jump_left_filled() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 2, y: 1 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 5, y: 1 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 10, y: 1 }, CellValue::Number(1.into()));

        // create_3x3_chart(&mut sheet, Pos { x: 20, y: 1 });
        // create_3x3_chart(&mut sheet, Pos { x: 25, y: 1 });

        assert_eq!(sheet.jump_left(Pos { x: 11, y: 1 }), Pos { x: 10, y: 1 });
        assert_eq!(sheet.jump_left(Pos { x: 10, y: 1 }), Pos { x: 5, y: 1 });
        assert_eq!(sheet.jump_left(Pos { x: 5, y: 1 }), Pos { x: 2, y: 1 });
        assert_eq!(sheet.jump_left(Pos { x: 2, y: 1 }), Pos { x: 1, y: 1 });
        assert_eq!(sheet.jump_left(Pos { x: 1, y: 1 }), Pos { x: 1, y: 1 });

        // // jump to the last cell in the second chart
        // assert_eq!(sheet.jump_left(Pos { x: 28, y: 1 }), Pos { x: 25, y: 1 });

        // // jump to the first cell in the second chart
        // assert_eq!(sheet.jump_left(Pos { x: 25, y: 1 }), Pos { x: 22, y: 1 });

        // Add more edge case tests
        assert_eq!(sheet.jump_left(Pos { x: 2, y: 1 }), Pos { x: 1, y: 1 });
        assert_eq!(sheet.jump_left(Pos { x: 1, y: 1 }), Pos { x: 1, y: 1 });
    }

    #[test]
    #[parallel]
    fn jump_left_chart() {
        // let mut sheet = Sheet::test();

        // create_3x3_chart(&mut sheet, Pos { x: 5, y: 1 });

        // assert_eq!(sheet.jump_left(Pos { x: 10, y: 2 }), Pos { x: 7, y: 2 });
    }

    #[test]
    #[parallel]
    fn jump_up_empty() {
        let sheet = Sheet::test();

        let pos = Pos { x: 1, y: 2 };
        let new_pos = sheet.jump_up(pos);
        assert_eq!(new_pos, Pos { x: 1, y: 1 });
        let new_pos = sheet.jump_up(Pos { x: 1, y: 5 });
        assert_eq!(new_pos, Pos { x: 1, y: 1 });
    }

    #[test]
    #[parallel]
    fn jump_up_filled() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 3, y: 5 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 3, y: 10 }, CellValue::Number(1.into()));

        // create_3x3_chart(&mut sheet, Pos { x: 3, y: 20 });
        // create_3x3_chart(&mut sheet, Pos { x: 3, y: 25 });

        // // jump to the last cell in the second chart
        // assert_eq!(sheet.jump_up(Pos { x: 3, y: 30 }), Pos { x: 3, y: 27 });

        // // jump to the last cell in the first chart
        // assert_eq!(sheet.jump_up(Pos { x: 3, y: 27 }), Pos { x: 3, y: 22 });
        // assert_eq!(sheet.jump_up(Pos { x: 3, y: 23 }), Pos { x: 3, y: 20 });

        assert_eq!(sheet.jump_up(Pos { x: 3, y: 22 }), Pos { x: 3, y: 10 });
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 12 }), Pos { x: 3, y: 10 });
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 10 }), Pos { x: 3, y: 5 });
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 9 }), Pos { x: 3, y: 5 });
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 5 }), Pos { x: 3, y: 1 });
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 3 }), Pos { x: 3, y: 1 });

        // Add edge case tests
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 2 }), Pos { x: 3, y: 1 });
        assert_eq!(sheet.jump_up(Pos { x: 3, y: 1 }), Pos { x: 3, y: 1 });
    }

    #[test]
    #[parallel]
    fn jump_up_chart() {
        // let mut sheet = Sheet::test();

        // create_3x3_chart(&mut sheet, Pos { x: 5, y: 1 });

        // assert_eq!(sheet.jump_up(Pos { x: 6, y: 4 }), Pos { x: 6, y: 3 });
    }

    #[test]
    #[parallel]
    fn jump_down_empty() {
        let sheet = Sheet::test();

        let pos = Pos { x: 1, y: 1 };
        let new_pos = sheet.jump_down(pos);
        assert_eq!(new_pos, Pos { x: 1, y: 2 });
        let new_pos = sheet.jump_down(Pos { x: 1, y: 5 });
        assert_eq!(new_pos, Pos { x: 1, y: 6 });
    }

    #[test]
    #[parallel]
    fn jump_down_filled() {
        let mut sheet = Sheet::test();

        sheet.set_cell_value(Pos { x: 3, y: 5 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 3, y: 10 }, CellValue::Number(1.into()));

        // create_3x3_chart(&mut sheet, Pos { x: 3, y: 20 });
        // create_3x3_chart(&mut sheet, Pos { x: 3, y: 25 });

        assert_eq!(sheet.jump_down(Pos { x: 3, y: 1 }), Pos { x: 3, y: 5 });
        assert_eq!(sheet.jump_down(Pos { x: 3, y: 5 }), Pos { x: 3, y: 10 });
        assert_eq!(sheet.jump_down(Pos { x: 3, y: 6 }), Pos { x: 3, y: 10 });

        // // jump to the first cell in the first chart
        // assert_eq!(sheet.jump_down(Pos { x: 3, y: 10 }), Pos { x: 3, y: 20 });
        // assert_eq!(sheet.jump_down(Pos { x: 3, y: 13 }), Pos { x: 3, y: 20 });

        // // jump to the first cell in the second chart
        // assert_eq!(sheet.jump_down(Pos { x: 3, y: 20 }), Pos { x: 3, y: 25 });
        // assert_eq!(sheet.jump_down(Pos { x: 3, y: 23 }), Pos { x: 3, y: 25 });

        // assert_eq!(sheet.jump_down(Pos { x: 3, y: 26 }), Pos { x: 3, y: 28 });
    }

    #[test]
    #[parallel]
    fn jump_with_consecutive_filled_cells() {
        let mut sheet = Sheet::test();

        // Create vertical sequence of filled cells
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 1, y: 2 }, CellValue::Number(2.into()));
        sheet.set_cell_value(Pos { x: 1, y: 3 }, CellValue::Number(3.into()));

        // Test jumping down through consecutive filled cells
        assert_eq!(sheet.jump_down(Pos { x: 1, y: 1 }), Pos { x: 1, y: 3 });

        // Test jumping up through consecutive filled cells
        assert_eq!(sheet.jump_up(Pos { x: 1, y: 3 }), Pos { x: 1, y: 1 });

        // Create horizontal sequence of filled cells
        sheet.set_cell_value(Pos { x: 5, y: 5 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 6, y: 5 }, CellValue::Number(2.into()));
        sheet.set_cell_value(Pos { x: 7, y: 5 }, CellValue::Number(3.into()));

        // Test jumping right through consecutive filled cells
        assert_eq!(sheet.jump_right(Pos { x: 5, y: 5 }), Pos { x: 7, y: 5 });

        // Test jumping left through consecutive filled cells
        assert_eq!(sheet.jump_left(Pos { x: 7, y: 5 }), Pos { x: 5, y: 5 });
    }

    #[test]
    #[parallel]
    fn test_jump_chart_on_edge() {
        // let mut sheet = Sheet::test();

        // create_3x3_chart(&mut sheet, Pos { x: 1, y: 1 });

        // assert_eq!(sheet.jump_left(Pos { x: 5, y: 1 }), Pos { x: 3, y: 1 });
        // assert_eq!(sheet.jump_left(Pos { x: 2, y: 1 }), Pos { x: 1, y: 1 });

        // assert_eq!(sheet.jump_right(Pos { x: 1, y: 1 }), Pos { x: 4, y: 1 });
        // assert_eq!(sheet.jump_right(Pos { x: 2, y: 1 }), Pos { x: 4, y: 1 });
        // assert_eq!(sheet.jump_right(Pos { x: 3, y: 1 }), Pos { x: 4, y: 1 });

        // assert_eq!(sheet.jump_up(Pos { x: 1, y: 5 }), Pos { x: 1, y: 3 });
        // assert_eq!(sheet.jump_up(Pos { x: 2, y: 4 }), Pos { x: 2, y: 1 });
        // assert_eq!(sheet.jump_up(Pos { x: 3, y: 3 }), Pos { x: 3, y: 1 });

        // assert_eq!(sheet.jump_down(Pos { x: 1, y: 1 }), Pos { x: 1, y: 4 });
        // assert_eq!(sheet.jump_down(Pos { x: 2, y: 2 }), Pos { x: 2, y: 4 });
        // assert_eq!(sheet.jump_down(Pos { x: 3, y: 4 }), Pos { x: 3, y: 5 });
    }
}
