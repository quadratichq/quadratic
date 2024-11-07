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
        current
    }

    fn jump_down(&self, current: Pos) -> Pos {
        current
    }

    fn jump_left(&self, current: Pos) -> Pos {
        let mut x = current.x;
        let y = current.y;

        // adjust the jump position if it is inside a chart to the left-most
        // edge of the chart
        if let Some((chart_pos, dt)) = self.chart_at(Pos { x, y }) {
            if let Some((_, h)) = dt.chart_output {
                x = chart_pos.x;
            }
        }

        // handle case of cell with content
        let mut prev_x: Option<i64> = None;
        if self.has_content(Pos { x, y }) {
            // if previous cell is empty, find the next cell with content
            if x - 1 == 0 {
                return Pos { x: 1, y };
            }
            if !self.has_content(Pos { x: x - 1, y }) {
                prev_x = self.find_prev_column(x - 2, y, true, true);
            }
        }
    }

    fn jump_right(&self, current: Pos) -> Pos {
        let mut x = current.x;
        let y = current.y;

        // adjust the jump position if it is inside a chart to the right-most
        // edge of the chart
        if let Some((chart_pos, dt)) = self.chart_at(Pos { x, y }) {
            if let Some((w, _)) = dt.chart_output {
                x = chart_pos.x + (w as i64) - 1;
            }
        }

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
            else {
                if let Some(next) = self.find_next_column(x + 2, y, false, false) {
                    next_x = Some(next - 1);
                } else {
                    next_x = Some(x + 1);
                }
            }
        }
        // otherwise find the next cell with content
        else {
            if let Some(next) = self.find_next_column(x + 1, y, false, true) {
                next_x = Some(next);
            }
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

    use crate::{
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        CellValue, CodeCellValue,
    };

    use super::*;

    // creates a 2x2 chart at the given position
    fn create_2x2_chart(sheet: &mut Sheet, pos: Pos) {
        let mut dt = DataTable::new(
            DataTableKind::CodeRun(CodeRun::default()),
            "Table 1",
            CellValue::Html("<html></html>".to_string()).into(),
            false,
            false,
            false,
            None,
        );
        dt.chart_output = Some((3, 3));

        sheet.set_cell_value(
            pos,
            CellValue::Code(CodeCellValue {
                code: "".to_string(),
                language: CodeCellLanguage::Javascript,
            }),
        );
        sheet.set_data_table(pos, Some(dt));
    }

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

        create_2x2_chart(&mut sheet, Pos { x: 20, y: 1 });
        create_2x2_chart(&mut sheet, Pos { x: 25, y: 1 });

        assert_eq!(sheet.jump_right(Pos { x: 0, y: 1 }), Pos { x: 1, y: 1 });
        assert_eq!(sheet.jump_right(Pos { x: 1, y: 1 }), Pos { x: 5, y: 1 });
        assert_eq!(sheet.jump_right(Pos { x: 5, y: 1 }), Pos { x: 10, y: 1 });

        // jump to the first cell in the first chart
        assert_eq!(sheet.jump_right(Pos { x: 10, y: 1 }), Pos { x: 20, y: 1 });

        // jump to the first cell in the second chart
        assert_eq!(sheet.jump_right(Pos { x: 20, y: 1 }), Pos { x: 25, y: 1 });
    }
}
