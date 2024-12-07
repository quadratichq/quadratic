//! Functionality to print borders for debugging.

use super::*;
use crate::Rect;

const HORIZONTAL: char = '\u{203E}';
const VERTICAL: char = '\u{23D0}';
const EMPTY: char = ' ';

#[allow(unused)]
impl BordersA1 {
    fn has_horizontal(horizontal: &[JsBorderHorizontal], x: i64, y: i64) -> bool {
        horizontal
            .iter()
            .filter(|h| h.width.is_some())
            .any(|h| y == h.y && x >= h.x && x < h.x + h.width.unwrap())
    }

    fn has_vertical(vertical: &[JsBorderVertical], x: i64, y: i64) -> bool {
        vertical
            .iter()
            .filter(|v| v.height.is_some())
            .any(|v| x == v.x && y >= v.y && y < v.y + v.height.unwrap())
    }

    pub(crate) fn print(&self) {
        if let Some(mut rect) = self.finite_bounds() {
            // extend the borders to include the last column and row
            rect.max.x += 1;
            rect.max.y += 1;
            let horizontal = self.horizontal_borders().unwrap_or_default();
            let vertical = self.vertical_borders().unwrap_or_default();

            // Print x-axis coordinates
            print!("   ");
            for col in rect.x_range() {
                print!("{:1} ", col % 10);
            }
            println!();

            for row in rect.y_range() {
                // Print y-axis coordinate
                print!("{:2} ", row);
                Self::print_row(&horizontal, &vertical, row, rect);
                println!();
            }
        }
    }

    fn print_row(
        horizontal: &[JsBorderHorizontal],
        vertical: &[JsBorderVertical],
        row: i64,
        rect: Rect,
    ) {
        for col in rect.x_range() {
            let chars = Self::get_border_chars(horizontal, vertical, col, row);
            print!("{:2}", chars); // Adjust spacing for coordinate labels
        }
    }

    fn get_border_chars(
        horizontal: &[JsBorderHorizontal],
        vertical: &[JsBorderVertical],
        col: i64,
        row: i64,
    ) -> String {
        let v_char = if Self::has_vertical(vertical, col, row) {
            VERTICAL
        } else {
            EMPTY
        };
        let h_char = if Self::has_horizontal(horizontal, col, row) {
            HORIZONTAL
        } else {
            EMPTY
        };
        format!("{}{}", v_char, h_char)
    }

    // ... existing code ...
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;
    use crate::{controller::GridController, grid::SheetId, A1Selection};

    #[test]
    fn print_borders_all() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("A1:D5"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(SheetId::TEST);
        sheet.borders_a1.print();
    }

    #[test]
    fn print_borders_outer() {
        let mut gc = GridController::test();
        gc.set_borders(
            A1Selection::test_a1("A1:D5"),
            BorderSelection::Outer,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(SheetId::TEST);
        sheet.borders_a1.print();
    }
}
