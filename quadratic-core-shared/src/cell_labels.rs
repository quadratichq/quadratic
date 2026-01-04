//! Cell label types for rendering.
//!
//! These types are used for efficient bincode communication between
//! quadratic-core and quadratic-rust-renderer.

use bincode::{Decode, Encode};

use crate::{CodeCellLanguage, Rgba};

// =============================================================================
// Alignment & Wrap Enums
// =============================================================================

/// Text alignment (matches core CellAlign).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Encode, Decode)]
pub enum CellAlign {
    Center,
    #[default]
    Left,
    Right,
}

/// Vertical alignment (matches core CellVerticalAlign).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Encode, Decode)]
pub enum CellVerticalAlign {
    Top,
    Middle,
    #[default]
    Bottom,
}

/// Text wrapping mode (matches core CellWrap).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Encode, Decode)]
pub enum CellWrap {
    #[default]
    Overflow,
    Wrap,
    Clip,
}

// =============================================================================
// Numeric Formatting
// =============================================================================

/// Numeric format kind (matches core NumericFormatKind).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Encode, Decode)]
pub enum NumericFormatKind {
    #[default]
    Number,
    Currency,
    Percentage,
    Exponential,
}

/// Numeric format with kind and optional symbol (matches core NumericFormat).
#[derive(Debug, Clone, PartialEq, Eq, Default, Encode, Decode)]
pub struct NumericFormat {
    pub kind: NumericFormatKind,
    pub symbol: Option<String>,
}

/// Number formatting info for cells.
#[derive(Debug, Clone, PartialEq, Eq, Default, Encode, Decode)]
pub struct RenderNumber {
    pub decimals: Option<i16>,
    pub commas: Option<bool>,
    pub format: Option<NumericFormat>,
}

// =============================================================================
// Special Cell Types
// =============================================================================

/// Special cell types that need custom rendering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Encode, Decode)]
pub enum RenderCellSpecial {
    Chart,
    SpillError,
    RunError,
    Logical,
    Checkbox,
    List,
}

// =============================================================================
// RichText Spans
// =============================================================================

/// A hyperlink span within a cell, with character range and URL.
#[derive(Debug, Clone, PartialEq, Eq, Default, Encode, Decode)]
pub struct RenderCellLinkSpan {
    /// Start character index (inclusive).
    pub start: u32,
    /// End character index (exclusive).
    pub end: u32,
    /// The URL to link to.
    pub url: String,
}

/// A formatting span within a cell for RichText inline styling.
/// These override the cell-level formatting for the specified character range.
#[derive(Debug, Clone, PartialEq, Default, Encode, Decode)]
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
    /// Text color override (None means use cell default, uses Rgba for efficiency).
    pub text_color: Option<Rgba>,
    /// Hyperlink URL (None means no link).
    pub link: Option<String>,
}

// =============================================================================
// Render Cell
// =============================================================================

/// A single cell's rendering data.
///
/// This contains all information needed to render cell text, including
/// the display value, formatting, alignment, and RichText spans.
#[derive(Debug, Clone, PartialEq, Default, Encode, Decode)]
pub struct RenderCell {
    /// Cell column position (1-indexed).
    pub x: i64,
    /// Cell row position (1-indexed).
    pub y: i64,

    /// Display text (already formatted for numbers).
    pub value: String,

    /// Code language, set only for the top left cell of a code output.
    pub language: Option<CodeCellLanguage>,

    /// Text alignment.
    pub align: Option<CellAlign>,
    /// Vertical alignment.
    pub vertical_align: Option<CellVerticalAlign>,
    /// Text wrap mode.
    pub wrap: Option<CellWrap>,

    /// Bold text.
    pub bold: Option<bool>,
    /// Italic text.
    pub italic: Option<bool>,
    /// Underline text.
    pub underline: Option<bool>,
    /// Strike-through text.
    pub strike_through: Option<bool>,
    /// Text color (uses Rgba for efficient renderer communication).
    pub text_color: Option<Rgba>,
    /// Font size in points (default is 14).
    pub font_size: Option<i16>,

    /// Special cell type (chart, error, checkbox, etc.).
    pub special: Option<RenderCellSpecial>,
    /// Number formatting info (for dynamic precision adjustment when clipped).
    pub number: Option<RenderNumber>,

    /// Whether this is a table name row.
    pub table_name: Option<bool>,
    /// Whether this is a column header row.
    pub column_header: Option<bool>,

    /// Hyperlink spans for RichText cells with hyperlinks (character ranges + URLs).
    pub link_spans: Vec<RenderCellLinkSpan>,
    /// Formatting spans for RichText cells with inline formatting overrides.
    pub format_spans: Vec<RenderCellFormatSpan>,
}

// =============================================================================
// Hash Container
// =============================================================================

/// Container for render cells within a hash region.
/// Used for communication between core and client.
#[derive(Debug, PartialEq)]
pub struct HashRenderCells {
    pub sheet_id: crate::SheetId,
    pub hash: crate::Pos,
    pub cells: Vec<RenderCell>,
}
