//! Functionality to print borders for debugging.

use super::{Borders, JsBorderHorizontal, JsBorderVertical};
use crate::Rect;

const HORIZONTAL: char = '\u{203E}';
const VERTICAL: char = '\u{23D0}';
const EMPTY: char = ' ';

impl Borders {
    fn has_horizontal(horizontal: &[JsBorderHorizontal], x: i64, y: i64) -> bool {
        horizontal
            .iter()
            .any(|h| y == h.y && x >= h.x && x < h.x + h.width)
    }

    fn has_vertical(vertical: &[JsBorderVertical], x: i64, y: i64) -> bool {
        vertical
            .iter()
            .any(|v| x == v.x && y >= v.y && y < v.y + v.height)
    }

    pub(crate) fn print_borders(&self) {
        if let Some(mut rect) = self.bounds() {
            dbg!(&rect);
            // extend the borders to include the last column and row
            rect.max.x += 1;
            rect.max.y += 1;
            let horizontal = self.horizontal_borders_in_rect(rect).unwrap_or(vec![]);
            let vertical = self.vertical_borders_in_rect(rect).unwrap_or(vec![]);

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
mod tests {
    use crate::{
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle},
        selection::Selection,
        SheetRect,
    };

    #[test]
    fn print_borders() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Horizontal,
            Some(BorderStyle::default()),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        sheet.borders.print_borders();
    }
}
