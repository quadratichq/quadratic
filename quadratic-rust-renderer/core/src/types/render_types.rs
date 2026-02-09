//! Render types for the Quadratic renderer
//!
//! These types are used for rendering and use `Rgba` instead of String for colors.
//! They are converted from the corresponding `Js*` types in quadratic-core.

use quadratic_core::color::Rgba;
use quadratic_core::grid::formatting::{CellAlign, CellVerticalAlign, CellWrap};
use quadratic_core::grid::js_types::{
    JsRenderCell, JsRenderCellFormatSpan, JsRenderCellLinkSpan, JsRenderFill,
};
pub use quadratic_core::grid::CodeCellLanguage;
use bincode::{Decode, Encode};
use serde::{Deserialize, Serialize};

// Re-export commonly used types from quadratic-core
pub use quadratic_core::grid::GridBounds;
pub use quadratic_core::grid::js_types::JsRenderCellSpecial as RenderCellSpecial;
pub use quadratic_core::grid::js_types::JsRenderCodeCell as RenderCodeCell;
pub use quadratic_core::grid::js_types::JsRenderCodeCellState as RenderCodeCellState;
pub use quadratic_core::grid::SheetId;
pub use quadratic_core::sheet_offsets::SheetOffsets;
pub use quadratic_core::Pos;

/// Parse a color string (hex #RRGGBB or CSS rgb(...)) into Rgba
pub fn parse_color(color: &str) -> Rgba {
    // Try hex format if it starts with #
    if color.starts_with('#') {
        if let Ok(rgba) = Rgba::color_from_str(color) {
            return rgba;
        }
    }
    // Try CSS rgb() format
    if color.starts_with("rgb(") {
        if let Ok(rgba) = Rgba::from_css_str(color) {
            return rgba;
        }
    }
    // Default to black if parsing fails
    Rgba::default()
}

// =============================================================================
// Border Types
// =============================================================================

/// Border line style
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Encode, Decode)]
pub enum BorderLineStyle {
    #[default]
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,
}

impl BorderLineStyle {
    /// Get the line thickness in pixels
    pub fn thickness(&self) -> f32 {
        match self {
            Self::Line1 => 1.0,
            Self::Line2 => 2.0,
            Self::Line3 => 3.0,
            Self::Dotted => 1.0,
            Self::Dashed => 1.0,
            Self::Double => 1.0, // Each line is 1px, but with gap
        }
    }
}

/// A horizontal border
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct HorizontalBorder {
    /// Start column (1-indexed)
    pub x: i64,
    /// Row (1-indexed) - border is at the top edge of this row
    pub y: i64,
    /// Width in cells (None = extends to edge of viewport)
    pub width: Option<i64>,
    /// Border color [r, g, b, a]
    pub color: [f32; 4],
    /// Line style
    pub style: BorderLineStyle,
}

/// A vertical border
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct VerticalBorder {
    /// Column (1-indexed) - border is at the left edge of this column
    pub x: i64,
    /// Start row (1-indexed)
    pub y: i64,
    /// Height in cells (None = extends to edge of viewport)
    pub height: Option<i64>,
    /// Border color [r, g, b, a]
    pub color: [f32; 4],
    /// Line style
    pub style: BorderLineStyle,
}

/// Collection of borders for a sheet
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct SheetBorders {
    /// Horizontal borders
    pub horizontal: Vec<HorizontalBorder>,
    /// Vertical borders
    pub vertical: Vec<VerticalBorder>,
}

impl SheetBorders {
    /// Create a new empty border collection
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
        style: BorderLineStyle,
    ) {
        self.horizontal.push(HorizontalBorder {
            x,
            y,
            width,
            color,
            style,
        });
    }

    /// Add a vertical border
    pub fn add_vertical(
        &mut self,
        x: i64,
        y: i64,
        height: Option<i64>,
        color: [f32; 4],
        style: BorderLineStyle,
    ) {
        self.vertical.push(VerticalBorder {
            x,
            y,
            height,
            color,
            style,
        });
    }
}

// =============================================================================
// Cell Rendering Types
// =============================================================================

/// A hyperlink span within a cell, with character range and URL.
#[derive(Default, Debug, Clone, PartialEq, Eq)]
pub struct RenderCellLinkSpan {
    /// Start character index (inclusive).
    pub start: u32,
    /// End character index (exclusive).
    pub end: u32,
    /// The hyperlink URL.
    pub url: String,
}

impl From<&JsRenderCellLinkSpan> for RenderCellLinkSpan {
    fn from(span: &JsRenderCellLinkSpan) -> Self {
        Self {
            start: span.start,
            end: span.end,
            url: span.url.clone(),
        }
    }
}

/// A formatting span within a cell, with character range and style overrides.
/// These override the cell-level formatting for the specified character range.
#[derive(Default, Debug, Clone, PartialEq)]
pub struct RenderCellFormatSpan {
    /// Start character index (inclusive).
    pub start: u32,
    /// End character index (exclusive).
    pub end: u32,
    /// Bold override (None means use cell default).
    pub bold: Option<bool>,
    /// Italic override (None means use cell default).
    pub italic: Option<bool>,
    /// Underline override (None means use cell default).
    pub underline: Option<bool>,
    /// Strike-through override (None means use cell default).
    pub strike_through: Option<bool>,
    /// Text color override (None means use cell default).
    pub text_color: Option<Rgba>,
    /// Hyperlink URL (None means no link).
    pub link: Option<String>,
}

impl From<&JsRenderCellFormatSpan> for RenderCellFormatSpan {
    fn from(span: &JsRenderCellFormatSpan) -> Self {
        Self {
            start: span.start,
            end: span.end,
            bold: span.bold,
            italic: span.italic,
            underline: span.underline,
            strike_through: span.strike_through,
            text_color: span.text_color.as_ref().map(|c| parse_color(c)),
            link: span.link.clone(),
        }
    }
}

/// Cell data for rendering (uses Rgba instead of String colors)
#[derive(Default, Debug, Clone, PartialEq)]
pub struct RenderCell {
    pub x: i64,
    pub y: i64,
    pub value: String,
    pub align: Option<CellAlign>,
    pub vertical_align: Option<CellVerticalAlign>,
    pub wrap: Option<CellWrap>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub text_color: Option<Rgba>,
    pub underline: Option<bool>,
    pub strike_through: Option<bool>,
    pub font_size: Option<i16>,
    pub table_name: Option<bool>,
    pub column_header: Option<bool>,
    pub special: Option<RenderCellSpecial>,
    /// Code language for table name cells (determines if icon is shown).
    pub language: Option<CodeCellLanguage>,
    /// Number of columns spanned by table name (for clipping to full table width).
    pub table_columns: Option<u32>,
    /// Hyperlink spans for RichText cells with hyperlinks (character ranges + URLs).
    pub link_spans: Vec<RenderCellLinkSpan>,
    /// Formatting spans for RichText cells with inline formatting overrides.
    pub format_spans: Vec<RenderCellFormatSpan>,
}

impl From<&JsRenderCell> for RenderCell {
    fn from(cell: &JsRenderCell) -> Self {
        Self {
            x: cell.x,
            y: cell.y,
            value: cell.value.clone(),
            align: cell.align,
            vertical_align: cell.vertical_align,
            wrap: cell.wrap,
            bold: cell.bold,
            italic: cell.italic,
            text_color: cell.text_color.as_ref().map(|c| parse_color(c)),
            underline: cell.underline,
            strike_through: cell.strike_through,
            font_size: cell.font_size,
            table_name: cell.table_name,
            column_header: cell.column_header,
            special: cell.special.clone(),
            language: cell.language.clone(),
            table_columns: None, // Not available from JsRenderCell, set manually for table names
            link_spans: cell.link_spans.iter().map(RenderCellLinkSpan::from).collect(),
            format_spans: cell.format_spans.iter().map(RenderCellFormatSpan::from).collect(),
        }
    }
}

impl From<JsRenderCell> for RenderCell {
    fn from(cell: JsRenderCell) -> Self {
        RenderCell::from(&cell)
    }
}

/// Fill rectangle for rendering
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RenderFill {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,
    pub color: Rgba,
}

impl RenderFill {
    pub fn new(x: i64, y: i64, w: u32, h: u32, color: Rgba) -> Self {
        Self { x, y, w, h, color }
    }
}

impl From<&JsRenderFill> for RenderFill {
    fn from(fill: &JsRenderFill) -> Self {
        Self {
            x: fill.x,
            y: fill.y,
            w: fill.w,
            h: fill.h,
            color: parse_color(&fill.color),
        }
    }
}

impl From<JsRenderFill> for RenderFill {
    fn from(fill: JsRenderFill) -> Self {
        RenderFill::from(&fill)
    }
}
