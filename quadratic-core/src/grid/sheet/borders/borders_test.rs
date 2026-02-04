//! Functionality to print borders for debugging.

use super::*;
use crate::Rect;

const HORIZONTAL: char = '\u{203E}';
const VERTICAL: char = '\u{23D0}';
const EMPTY: char = ' ';
const INFINITE: i64 = 100000;

#[allow(unused)]
impl Borders {
    fn has_horizontal(horizontal: &[JsBorderHorizontal], x: i64, y: i64) -> bool {
        horizontal.iter().any(|h| {
            (y == h.y || h.unbounded && y >= h.y)
                && x >= h.x
                && x < h.x + h.width.unwrap_or(INFINITE)
        })
    }

    fn has_vertical(vertical: &[JsBorderVertical], x: i64, y: i64) -> bool {
        vertical.iter().any(|v| {
            (x == v.x || v.unbounded && x >= v.x)
                && y >= v.y
                && y < v.y + v.height.unwrap_or(INFINITE)
        })
    }

    pub(crate) fn print(&self, rect: Option<Rect>) {
        if let Some(mut rect) = rect.or(self.finite_bounds()) {
            // extend the borders to include the last column and row
            rect.max.x += 1;
            rect.max.y += 1;
            let horizontal = self.horizontal_borders(None, None).unwrap_or_default();
            let vertical = self.vertical_borders(None, None).unwrap_or_default();

            // Print x-axis coordinates
            print!("   ");
            for col in rect.x_range() {
                print!("{} ", (b'A' + (col % 26 - 1) as u8) as char);
            }
            println!();

            for row in rect.y_range() {
                // Print y-axis coordinate
                print!("{row:2} ");
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
            print!("{chars:2}"); // Adjust spacing for coordinate labels
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
        format!("{v_char}{h_char}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{a1::A1Selection, controller::GridController, grid::SheetId};

    #[test]
    fn print_borders() {
        // Test all border selection types
        let selections = [
            BorderSelection::All,
            BorderSelection::Outer,
            BorderSelection::Inner,
            BorderSelection::Horizontal,
            BorderSelection::Vertical,
            BorderSelection::Left,
            BorderSelection::Right,
            BorderSelection::Top,
            BorderSelection::Bottom,
        ];

        // todo: gc should be defined above and cleared after each print (when
        // that functionality is working)

        for selection in selections {
            let mut gc = GridController::test();
            println!("\n{selection:?}:");
            gc.set_borders(
                A1Selection::test_a1("A1:D5"),
                selection,
                Some(BorderStyle::default()),
                None,
                false,
            );
            let sheet = gc.sheet(SheetId::TEST);
            sheet.borders.print(Some(Rect::new(1, 1, 6, 6)));
        }
    }
}
