//! Content - main container for all renderable elements
//!
//! Equivalent to Content.ts from the Pixi.js implementation

use quadratic_core_shared::SheetOffsets;

use crate::viewport::Viewport;

use super::cursor::Cursor;
use super::grid_lines::GridLines;

/// Main container for all renderable content
pub struct Content {
    /// Grid lines renderer
    pub grid_lines: GridLines,

    /// Cursor renderer
    pub cursor: Cursor,

    /// Whether any content is dirty and needs re-rendering
    dirty: bool,
}

impl Content {
    /// Create new content container
    pub fn new() -> Self {
        Self {
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

        // Check if anything is dirty
        self.dirty = self.grid_lines.dirty || self.cursor.dirty;
    }

    /// Check if content needs re-rendering
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark content as clean after rendering
    pub fn mark_clean(&mut self) {
        self.grid_lines.mark_clean();
        self.cursor.mark_clean();
        self.dirty = false;
    }
}

impl Default for Content {
    fn default() -> Self {
        Self::new()
    }
}
