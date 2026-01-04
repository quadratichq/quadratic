//! UI module - layout for UI elements
//!
//! Handles grid lines, cursor, and headings layout.

mod cursor;
mod grid_lines;
mod headings;

pub use cursor::CursorLayout;
pub use grid_lines::GridLinesLayout;
pub use headings::HeadingsLayout;

use quadratic_core_shared::SheetOffsets;

use crate::viewport::Viewport;

/// All UI layout state
#[derive(Default)]
pub struct UILayout {
    pub grid_lines: GridLinesLayout,
    pub cursor: CursorLayout,
    pub headings: HeadingsLayout,
}

impl UILayout {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update all UI layouts for current viewport
    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        self.grid_lines.update(viewport, offsets);
        self.cursor.update(offsets);
        self.headings.update(viewport, offsets);
    }

    pub fn is_dirty(&self) -> bool {
        self.grid_lines.dirty || self.cursor.dirty || self.headings.dirty
    }

    pub fn mark_clean(&mut self) {
        self.grid_lines.dirty = false;
        self.cursor.dirty = false;
        self.headings.dirty = false;
    }
}
