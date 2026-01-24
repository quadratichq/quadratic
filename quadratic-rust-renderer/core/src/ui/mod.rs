//! UI elements for rendering
//!
//! - Cursor: Selection highlight and border
//! - Grid lines: Cell grid
//! - Headings: Column/row headers

mod cursor;
mod grid_lines;
mod headings;

pub use cursor::Cursor;
pub use grid_lines::{GridLines, GRID_LINE_COLOR};
pub use headings::Headings;

/// UI manager containing all UI elements
pub struct UI {
    pub cursor: Cursor,
    pub grid_lines: GridLines,
    pub headings: Headings,
}

impl UI {
    pub fn new() -> Self {
        Self {
            cursor: Cursor::new(),
            grid_lines: GridLines::new(),
            headings: Headings::new(),
        }
    }
}

impl Default for UI {
    fn default() -> Self {
        Self::new()
    }
}
