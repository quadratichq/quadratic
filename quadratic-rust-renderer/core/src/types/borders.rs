//! Border types for rendering
//!
//! These types represent cell borders for rendering. They are designed to be
//! platform-agnostic and can be populated from quadratic-core's border data.

use super::LineBuffer;
use bincode::{Decode, Encode};
use quadratic_core_shared::SheetOffsets;
use serde::{Deserialize, Serialize};

/// Border line style
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Encode, Decode)]
pub enum BorderLineStyle {
    #[default]
    Line1, // 1px solid
    Line2, // 2px solid
    Line3, // 3px solid
    Dotted,
    Dashed,
    Double,
}

impl BorderLineStyle {
    /// Get the line width in pixels
    pub fn width(&self) -> f32 {
        match self {
            BorderLineStyle::Line1 => 1.0,
            BorderLineStyle::Line2 => 2.0,
            BorderLineStyle::Line3 => 3.0,
            BorderLineStyle::Dotted => 1.0,
            BorderLineStyle::Dashed => 1.0,
            BorderLineStyle::Double => 3.0,
        }
    }
}

/// A horizontal border line (spans across columns at a row boundary)
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct HorizontalBorder {
    /// Color [r, g, b, a] as floats 0.0-1.0
    pub color: [f32; 4],
    /// Line style
    pub line_style: BorderLineStyle,
    /// Start column (1-indexed)
    pub x: i64,
    /// Row position (1-indexed, the line is at the TOP edge of this row)
    pub y: i64,
    /// Width in columns (None = extends to edge of visible area)
    pub width: Option<i64>,
}

/// A vertical border line (spans across rows at a column boundary)
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct VerticalBorder {
    /// Color [r, g, b, a] as floats 0.0-1.0
    pub color: [f32; 4],
    /// Line style
    pub line_style: BorderLineStyle,
    /// Column position (1-indexed, the line is at the LEFT edge of this column)
    pub x: i64,
    /// Start row (1-indexed)
    pub y: i64,
    /// Height in rows (None = extends to edge of visible area)
    pub height: Option<i64>,
}

/// Collection of borders for a sheet
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct SheetBorders {
    pub horizontal: Vec<HorizontalBorder>,
    pub vertical: Vec<VerticalBorder>,
}

impl SheetBorders {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if there are any borders
    pub fn is_empty(&self) -> bool {
        self.horizontal.is_empty() && self.vertical.is_empty()
    }

    /// Add a horizontal border
    pub fn add_horizontal(
        &mut self,
        x: i64,
        y: i64,
        width: Option<i64>,
        color: [f32; 4],
        line_style: BorderLineStyle,
    ) {
        self.horizontal.push(HorizontalBorder {
            color,
            line_style,
            x,
            y,
            width,
        });
    }

    /// Add a vertical border
    pub fn add_vertical(
        &mut self,
        x: i64,
        y: i64,
        height: Option<i64>,
        color: [f32; 4],
        line_style: BorderLineStyle,
    ) {
        self.vertical.push(VerticalBorder {
            color,
            line_style,
            x,
            y,
            height,
        });
    }

    /// Convert borders to a LineBuffer for rendering
    ///
    /// The viewport bounds (min_col, min_row, max_col, max_row) are used to
    /// limit unbounded borders and filter out-of-view borders.
    pub fn to_line_buffer(
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
