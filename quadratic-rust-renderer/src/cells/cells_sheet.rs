//! Cells sheet - manages cells for a single sheet
//!
//! Equivalent to CellsSheet.ts from the Pixi.js implementation

use std::collections::HashMap;

use quadratic_core_shared::SheetOffsets;

use crate::viewport::Viewport;

/// Represents a cell's visual content
#[derive(Debug, Clone)]
pub struct CellContent {
    /// Column index
    pub col: i64,

    /// Row index
    pub row: i64,

    /// Cell text content
    pub text: Option<String>,

    /// Background color (RGBA)
    pub background_color: Option<[f32; 4]>,

    /// Text color (RGBA)
    pub text_color: [f32; 4],

    /// Whether the cell is dirty and needs re-rendering
    pub dirty: bool,
}

impl CellContent {
    /// Create a new empty cell
    pub fn new(col: i64, row: i64) -> Self {
        Self {
            col,
            row,
            text: None,
            background_color: None,
            text_color: [0.0, 0.0, 0.0, 1.0], // Black text
            dirty: true,
        }
    }

    /// Get the cell's world-space bounds using sheet offsets
    pub fn bounds(&self, offsets: &SheetOffsets) -> CellBounds {
        let (x, width) = offsets.column_position_size(self.col);
        let (y, height) = offsets.row_position_size(self.row);
        CellBounds {
            x: x as f32,
            y: y as f32,
            width: width as f32,
            height: height as f32,
        }
    }
}

/// Cell bounds in world coordinates
#[derive(Debug, Clone, Copy)]
pub struct CellBounds {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Manages cells for a single sheet
pub struct CellsSheet {
    /// Sheet ID
    pub sheet_id: String,

    /// Sheet offsets for column widths and row heights
    pub sheet_offsets: SheetOffsets,

    /// Cells indexed by (col, row)
    cells: HashMap<(i64, i64), CellContent>,

    /// Cells that are currently visible
    visible_cells: Vec<(i64, i64)>,

    /// Whether the sheet needs re-rendering
    pub dirty: bool,
}

impl CellsSheet {
    /// Create a new cells sheet
    pub fn new(sheet_id: String) -> Self {
        // Test: set column 1 to 300px width to verify offsets work
        let mut sheet_offsets = SheetOffsets::default();
        sheet_offsets.set_column_width(3, 190.0);
        sheet_offsets.set_row_height(10, 73.0);
        Self {
            sheet_id,
            sheet_offsets,
            cells: HashMap::new(),
            visible_cells: Vec::new(),
            dirty: true,
        }
    }

    /// Set a cell's content
    pub fn set_cell(&mut self, col: i64, row: i64, text: Option<String>) {
        let cell = self
            .cells
            .entry((col, row))
            .or_insert_with(|| CellContent::new(col, row));
        cell.text = text;
        cell.dirty = true;
        self.dirty = true;
    }

    /// Set a cell's background color
    pub fn set_cell_background(&mut self, col: i64, row: i64, color: Option<[f32; 4]>) {
        let cell = self
            .cells
            .entry((col, row))
            .or_insert_with(|| CellContent::new(col, row));
        cell.background_color = color;
        cell.dirty = true;
        self.dirty = true;
    }

    /// Get a cell's content
    pub fn get_cell(&self, col: i64, row: i64) -> Option<&CellContent> {
        self.cells.get(&(col, row))
    }

    /// Get the bounds for a cell position using sheet offsets
    pub fn cell_bounds(&self, col: i64, row: i64) -> CellBounds {
        let (x, width) = self.sheet_offsets.column_position_size(col);
        let (y, height) = self.sheet_offsets.row_position_size(row);
        CellBounds {
            x: x as f32,
            y: y as f32,
            width: width as f32,
            height: height as f32,
        }
    }

    /// Remove a cell
    pub fn remove_cell(&mut self, col: i64, row: i64) {
        self.cells.remove(&(col, row));
        self.dirty = true;
    }

    /// Update visible cells based on the viewport
    pub fn cull(&mut self, viewport: &Viewport) {
        self.visible_cells.clear();

        let bounds = viewport.visible_bounds();

        // Calculate visible cell range using offsets
        let (first_col, _) = self
            .sheet_offsets
            .column_from_x(bounds.left.max(0.0) as f64);
        let (last_col, _) = self
            .sheet_offsets
            .column_from_x(bounds.right.max(0.0) as f64);
        let (first_row, _) = self.sheet_offsets.row_from_y(bounds.top.max(0.0) as f64);
        let (last_row, _) = self.sheet_offsets.row_from_y(bounds.bottom.max(0.0) as f64);

        // Find visible cells
        for (&(col, row), _cell) in &self.cells {
            if col >= first_col && col <= last_col + 1 && row >= first_row && row <= last_row + 1 {
                self.visible_cells.push((col, row));
            }
        }
    }

    /// Get visible cells
    pub fn visible_cells(&self) -> impl Iterator<Item = &CellContent> {
        self.visible_cells
            .iter()
            .filter_map(|pos| self.cells.get(pos))
    }

    /// Get all cells with background colors (for rendering fills)
    pub fn cells_with_fills(&self) -> impl Iterator<Item = &CellContent> {
        self.visible_cells
            .iter()
            .filter_map(|pos| self.cells.get(pos))
            .filter(|cell| cell.background_color.is_some())
    }

    /// Mark as clean after rendering
    pub fn mark_clean(&mut self) {
        for cell in self.cells.values_mut() {
            cell.dirty = false;
        }
        self.dirty = false;
    }
}
