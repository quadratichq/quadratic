//! Border rendering extensions
//!
//! Extends the shared border types with rendering-specific functionality.

use super::FillBuffer;
use quadratic_core::sheet_offsets::SheetOffsets;

// Re-export the render types
pub use super::render_types::SheetBorders;

/// Fix alpha if it's suspiciously low - old grid files have a bug where
/// alpha was set to 1 (instead of 255) due to TypeScript/Rust type mismatch
fn fix_alpha_if_needed(color: [f32; 4]) -> [f32; 4] {
    if color[3] > 0.0 && color[3] < 0.1 {
        [color[0], color[1], color[2], 1.0]
    } else {
        color
    }
}

/// Extension trait for SheetBorders to add rendering functionality
pub trait SheetBordersRender {
    /// Convert borders to a FillBuffer for rendering (quads with thickness)
    ///
    /// The viewport bounds (min_col, min_row, max_col, max_row) are used to
    /// limit unbounded borders and filter out-of-view borders.
    fn to_fill_buffer(
        &self,
        offsets: &SheetOffsets,
        min_col: i64,
        min_row: i64,
        max_col: i64,
        max_row: i64,
    ) -> FillBuffer;
}

impl SheetBordersRender for SheetBorders {
    fn to_fill_buffer(
        &self,
        offsets: &SheetOffsets,
        min_col: i64,
        min_row: i64,
        max_col: i64,
        max_row: i64,
    ) -> FillBuffer {
        let mut buffer = FillBuffer::new();

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

            let thickness = border.style.thickness();
            let half_thickness = thickness / 2.0;

            // Create a horizontal quad centered on the border position
            let rect_x = x1 - half_thickness;
            let rect_y = y - half_thickness;
            let rect_w = (x2 - x1) + thickness;
            let rect_h = thickness;

            let color = fix_alpha_if_needed(border.color);
            buffer.add_rect(rect_x, rect_y, rect_w, rect_h, color);
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

            let thickness = border.style.thickness();
            let half_thickness = thickness / 2.0;

            // Create a vertical quad centered on the border position
            let rect_x = x - half_thickness;
            let rect_y = y1 - half_thickness;
            let rect_w = thickness;
            let rect_h = (y2 - y1) + thickness;

            let color = fix_alpha_if_needed(border.color);
            buffer.add_rect(rect_x, rect_y, rect_w, rect_h, color);
        }

        buffer
    }
}

#[cfg(test)]
mod tests {
    use quadratic_core::sheet_offsets::SheetOffsets;

    use super::SheetBordersRender;
    use crate::{BorderLineStyle, SheetBorders};

    #[test]
    fn test_sheet_borders_to_fill_buffer() {
        let mut borders = SheetBorders::default();

        // Add a horizontal border at row 2, spanning columns 1-3
        borders.add_horizontal(1, 2, Some(3), [0.0, 0.0, 0.0, 1.0], BorderLineStyle::Line1);

        // Add a vertical border at column 2, spanning rows 1-3
        borders.add_vertical(2, 1, Some(3), [0.0, 0.0, 0.0, 1.0], BorderLineStyle::Line1);

        let offsets = SheetOffsets::default();
        let buffer = borders.to_fill_buffer(&offsets, 1, 1, 10, 10);

        // Should have 2 quads (1 horizontal + 1 vertical) = 12 vertices = 72 floats
        assert_eq!(buffer.vertices.len(), 72);
    }

    #[test]
    fn test_thick_borders() {
        let mut borders = SheetBorders::default();

        // Add a thick horizontal border (line3 = 3 pixels)
        borders.add_horizontal(1, 2, Some(3), [1.0, 0.0, 0.0, 1.0], BorderLineStyle::Line3);

        let offsets = SheetOffsets::default();
        let buffer = borders.to_fill_buffer(&offsets, 1, 1, 10, 10);

        // Should have 1 quad = 6 vertices = 36 floats
        assert_eq!(buffer.vertices.len(), 36);
    }
}
