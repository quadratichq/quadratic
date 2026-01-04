//! Border types for cell borders
//!
//! These types represent cell border definitions that can be shared
//! between quadratic-core and the renderer.

use bincode::{Decode, Encode};
use serde::{Deserialize, Serialize};

/// Border line style
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, Encode, Decode)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
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
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
}
