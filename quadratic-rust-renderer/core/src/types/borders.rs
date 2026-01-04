//! Border rendering extensions
//!
//! Extends the shared border types with rendering-specific functionality.

use super::LineBuffer;
use quadratic_core_shared::SheetOffsets;

// Re-export the shared border types
pub use quadratic_core_shared::{BorderLineStyle, HorizontalBorder, SheetBorders, VerticalBorder};

/// Extension trait for SheetBorders to add rendering functionality
pub trait SheetBordersRender {
    /// Convert borders to a LineBuffer for rendering
    ///
    /// The viewport bounds (min_col, min_row, max_col, max_row) are used to
    /// limit unbounded borders and filter out-of-view borders.
    fn to_line_buffer(
        &self,
        offsets: &SheetOffsets,
        min_col: i64,
        min_row: i64,
        max_col: i64,
        max_row: i64,
    ) -> LineBuffer;
}

impl SheetBordersRender for SheetBorders {
    fn to_line_buffer(
        &self,
        offsets: &SheetOffsets,
        min_col: i64,
        min_row: i64,
        max_col: i64,
        max_row: i64,
    ) -> LineBuffer {
        let mut buffer = LineBuffer::new();

        // Convert horizontal borders
        for border in &self.horizontal {
            // Skip if completely outside viewport
            if border.y < min_row || border.y > max_row + 1 {
                continue;
            }

            let start_col = border.x.max(min_col);
            let end_col = border
                .width
                .map(|w| border.x + w - 1)
                .unwrap_or(max_col)
                .min(max_col);

            if start_col > end_col {
                continue;
            }

            // Get Y position (top edge of the row)
            let (y, _) = offsets.row_position_size(border.y);
            let y = y as f32;

            // Get X positions
            let (x1, _) = offsets.column_position_size(start_col);
            let (x2, w2) = offsets.column_position_size(end_col);
            let x1 = x1 as f32;
            let x2 = (x2 + w2) as f32;

            buffer.add_line(x1, y, x2, y, border.color);
        }

        // Convert vertical borders
        for border in &self.vertical {
            // Skip if completely outside viewport
            if border.x < min_col || border.x > max_col + 1 {
                continue;
            }

            let start_row = border.y.max(min_row);
            let end_row = border
                .height
                .map(|h| border.y + h - 1)
                .unwrap_or(max_row)
                .min(max_row);

            if start_row > end_row {
                continue;
            }

            // Get X position (left edge of the column)
            let (x, _) = offsets.column_position_size(border.x);
            let x = x as f32;

            // Get Y positions
            let (y1, _) = offsets.row_position_size(start_row);
            let (y2, h2) = offsets.row_position_size(end_row);
            let y1 = y1 as f32;
            let y2 = (y2 + h2) as f32;

            buffer.add_line(x, y1, x, y2, border.color);
        }

        buffer
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sheet_borders_to_line_buffer() {
        let mut borders = SheetBorders::new();

        // Add a horizontal border at row 2, spanning columns 1-3
        borders.add_horizontal(1, 2, Some(3), [0.0, 0.0, 0.0, 1.0], BorderLineStyle::Line1);

        // Add a vertical border at column 2, spanning rows 1-3
        borders.add_vertical(2, 1, Some(3), [0.0, 0.0, 0.0, 1.0], BorderLineStyle::Line1);

        let offsets = SheetOffsets::default();
        let buffer = borders.to_line_buffer(&offsets, 1, 1, 10, 10);

        // Should have 2 lines (1 horizontal + 1 vertical) = 4 vertices = 24 floats
        assert_eq!(buffer.vertices.len(), 24);
    }
}
