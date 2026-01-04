//! UI - container for all non-sheet-specific UI elements

use quadratic_core_shared::SheetOffsets;

use crate::viewport::Viewport;

use super::cursor::Cursor;
use super::grid_lines::GridLines;
use super::headings::GridHeadings;

/// Main container for all renderable UI content (grid lines, cursor, headings)
pub struct UI {
    /// Grid headings (column/row headers) renderer
    pub headings: GridHeadings,

    /// Grid lines renderer
    pub grid_lines: GridLines,

    /// Cursor renderer
    pub cursor: Cursor,

    /// Whether any content is dirty and needs re-rendering
    dirty: bool,
}

impl UI {
    /// Create new UI container
    pub fn new() -> Self {
        Self {
            headings: GridHeadings::new(),
            grid_lines: GridLines::new(),
            cursor: Cursor::new(),
            dirty: true,
        }
    }

    /// Update all content based on the current viewport and sheet offsets
    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        // Update grid lines based on visible bounds and offsets
        self.grid_lines.update(viewport, offsets);

        // Update cursor
        self.cursor.update(viewport, offsets);

        // Update headings DPR if changed
        self.headings.set_dpr(viewport.dpr());

        // Update headings (pass effective_scale = scale * dpr for proper device pixel sizing)
        self.headings.update(
            viewport.x(),
            viewport.y(),
            viewport.effective_scale(),
            viewport.width(),
            viewport.height(),
            offsets,
        );

        // Check if anything is dirty
        self.dirty = self.grid_lines.dirty || self.cursor.dirty || self.headings.is_dirty();
    }

    /// Check if content needs re-rendering
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark content as clean after rendering
    pub fn mark_clean(&mut self) {
        self.grid_lines.mark_clean();
        self.cursor.mark_clean();
        self.headings.mark_clean();
        self.dirty = false;
    }
}

impl Default for UI {
    fn default() -> Self {
        Self::new()
    }
}
