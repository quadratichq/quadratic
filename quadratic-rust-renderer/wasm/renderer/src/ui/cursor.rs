//! Cursor renderer
//!
//! Equivalent to Cursor.ts from the Pixi.js implementation

use quadratic_core_shared::{A1Selection, CellRefRange, Pos, Rect, SheetOffsets};

use quadratic_renderer_core::{RenderContext, Color, LineScaling, Lines, Rects};
use crate::viewport::Viewport;

/// Cursor selection color (blue with transparency)
pub const CURSOR_COLOR: Color = [0.2, 0.4, 0.9, 1.0];
pub const CURSOR_FILL_COLOR: Color = [0.2, 0.4, 0.9, 0.1];

/// Represents a rectangular selection
#[derive(Debug, Clone, Copy)]
pub struct CursorRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Cursor renderer - handles selection display
pub struct Cursor {
    /// Currently selected cell (column, row)
    pub selected_cell: (i64, i64),

    /// Selection range (start_col, start_row, end_col, end_row)
    pub selection: Option<(i64, i64, i64, i64)>,

    /// Computed cursor rectangle in world coordinates
    pub rect: CursorRect,

    /// Border color
    pub border_color: Color,

    /// Fill color
    pub fill_color: Color,

    /// Whether the cursor needs to be recalculated
    pub dirty: bool,

    /// Whether the cursor is visible
    pub visible: bool,

    /// Batched rectangles for fill
    rects: Rects,

    /// Batched lines for border (2px, pixel-scaled)
    lines: Lines,
}

impl Cursor {
    /// Create a new cursor renderer
    pub fn new() -> Self {
        Self {
            selected_cell: (0, 0),
            selection: None,
            rect: CursorRect {
                x: 0.0,
                y: 0.0,
                width: 100.0, // Will be updated with actual offsets
                height: 21.0, // Will be updated with actual offsets
            },
            border_color: CURSOR_COLOR,
            fill_color: CURSOR_FILL_COLOR,
            dirty: true,
            visible: true,
            rects: Rects::new(),
            lines: Lines::with_thickness(2.0, LineScaling::ScreenPixel),
        }
    }

    /// Set the selected cell
    pub fn set_selected_cell(&mut self, col: i64, row: i64) {
        if self.selected_cell != (col, row) {
            self.selected_cell = (col, row);
            self.selection = None;
            self.dirty = true;
        }
    }

    /// Set the selection range
    pub fn set_selection(&mut self, start_col: i64, start_row: i64, end_col: i64, end_row: i64) {
        let new_selection = Some((start_col, start_row, end_col, end_row));
        if self.selection != new_selection {
            self.selection = new_selection;
            self.dirty = true;
        }
    }

    /// Set from A1Selection (synced from client)
    pub fn set_a1_selection(&mut self, selection: A1Selection) {
        // Update cursor position
        self.selected_cell = (selection.cursor.x, selection.cursor.y);

        // Get the selection range from the first range (if any)
        // For now, we only handle the first range; multi-range selections
        // would require more complex rendering
        if let Some(range) = selection.ranges.first() {
            match range {
                CellRefRange::Sheet { range } => {
                    // Get the bounding rectangle of the range
                    let start = range.start;
                    let end = range.end;
                    let start_col = start.col.coord;
                    let start_row = start.row.coord;
                    let end_col = end.col.coord;
                    let end_row = end.row.coord;

                    // Only set selection if it's more than a single cell
                    if start_col != end_col || start_row != end_row {
                        self.selection = Some((start_col, start_row, end_col, end_row));
                    } else {
                        self.selection = None;
                    }
                }
                CellRefRange::Table { .. } => {
                    // Table references need context to resolve; for now, just use cursor
                    self.selection = None;
                }
            }
        } else {
            self.selection = None;
        }

        self.dirty = true;
    }

    /// Clear the selection (keep only single cell)
    pub fn clear_selection(&mut self) {
        if self.selection.is_some() {
            self.selection = None;
            self.dirty = true;
        }
    }

    /// Update cursor based on current viewport and sheet offsets
    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        if !self.dirty {
            return;
        }

        let scale = viewport.effective_scale();

        // Calculate cursor rectangle using sheet offsets for accurate positioning
        if let Some((start_col, start_row, end_col, end_row)) = self.selection {
            let min_col = start_col.min(end_col);
            let max_col = start_col.max(end_col);
            let min_row = start_row.min(end_row);
            let max_row = start_row.max(end_row);

            // Use screen_rect_cell_offsets for range selection
            let screen_rect = offsets.screen_rect_cell_offsets(Rect {
                min: Pos {
                    x: min_col,
                    y: min_row,
                },
                max: Pos {
                    x: max_col,
                    y: max_row,
                },
            });

            self.rect = CursorRect {
                x: screen_rect.x as f32,
                y: screen_rect.y as f32,
                width: screen_rect.w as f32,
                height: screen_rect.h as f32,
            };
        } else {
            // Use cell_offsets for single cell selection
            let screen_rect = offsets.cell_offsets(self.selected_cell.0, self.selected_cell.1);
            self.rect = CursorRect {
                x: screen_rect.x as f32,
                y: screen_rect.y as f32,
                width: screen_rect.w as f32,
                height: screen_rect.h as f32,
            };
        }

        // Rebuild geometry
        self.rects.clear();
        self.lines.clear();

        // Cursor fill
        self.rects.add(
            self.rect.x,
            self.rect.y,
            self.rect.width,
            self.rect.height,
            self.fill_color,
        );

        // Cursor border (4 lines)
        let x1 = self.rect.x;
        let y1 = self.rect.y;
        let x2 = self.rect.x + self.rect.width;
        let y2 = self.rect.y + self.rect.height;

        self.lines.add(x1, y1, x2, y1, self.border_color, scale); // Top
        self.lines.add(x2, y1, x2, y2, self.border_color, scale); // Right
        self.lines.add(x2, y2, x1, y2, self.border_color, scale); // Bottom
        self.lines.add(x1, y2, x1, y1, self.border_color, scale); // Left
    }

    /// Mark as clean after rendering
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Get fill rect vertices
    pub fn get_fill_vertices(&self) -> Option<&[f32]> {
        if self.visible && !self.rects.is_empty() {
            Some(self.rects.vertices())
        } else {
            None
        }
    }

    /// Get border line vertices (must specify viewport_scale for pixel-scaled lines)
    pub fn get_border_vertices(&self, _viewport_scale: f32) -> Option<&[f32]> {
        if self.visible && !self.lines.is_empty() {
            Some(self.lines.vertices())
        } else {
            None
        }
    }

    /// Render cursor using RenderContext
    pub fn render(
        &mut self,
        ctx: &mut impl RenderContext,
        matrix: &[f32; 16],
        viewport_scale: f32,
    ) {
        if !self.visible {
            return;
        }

        // Draw fill first (triangles)
        self.rects.render(ctx, matrix);

        // Draw border on top (lines rendered as triangles with pixel scaling)
        // Note: scale is now applied at add time, not render time
        let _ = viewport_scale;
        self.lines.render(ctx, matrix);
    }
}

impl Default for Cursor {
    fn default() -> Self {
        Self::new()
    }
}
