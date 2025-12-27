//! Cell formatting types.

use serde::{Deserialize, Serialize};

/// Horizontal text alignment.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum CellAlign {
    Left,
    Center,
    Right,
}

impl CellAlign {
    /// Convert to CSS text-align value
    pub const fn as_css(&self) -> &'static str {
        match self {
            CellAlign::Left => "left",
            CellAlign::Center => "center",
            CellAlign::Right => "right",
        }
    }
}

/// Vertical text alignment.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum CellVerticalAlign {
    Top,
    Middle,
    Bottom,
}

impl CellVerticalAlign {
    /// Convert to CSS vertical-align value
    pub const fn as_css(&self) -> &'static str {
        match self {
            CellVerticalAlign::Top => "top",
            CellVerticalAlign::Middle => "middle",
            CellVerticalAlign::Bottom => "bottom",
        }
    }
}

/// Text wrapping behavior.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum CellWrap {
    /// Text overflows into adjacent cells
    #[default]
    Overflow,
    /// Text wraps within the cell
    Wrap,
    /// Text is clipped at cell boundary
    Clip,
}

/// Numeric format kind.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum NumericFormatKind {
    #[default]
    Number,
    Currency,
    Percentage,
    Exponential,
}

/// Numeric formatting options.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
pub struct NumericFormat {
    #[serde(rename = "type")]
    pub kind: NumericFormatKind,
    pub symbol: Option<String>,
}

impl NumericFormat {
    /// Create a percentage format
    pub fn percentage() -> Self {
        Self {
            kind: NumericFormatKind::Percentage,
            symbol: None,
        }
    }

    /// Create a number format
    pub fn number() -> Self {
        Self {
            kind: NumericFormatKind::Number,
            symbol: None,
        }
    }

    /// Create a currency format with the given symbol
    pub fn currency(symbol: impl Into<String>) -> Self {
        Self {
            kind: NumericFormatKind::Currency,
            symbol: Some(symbol.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_align() {
        assert_eq!(CellAlign::Left.as_css(), "left");
        assert_eq!(CellAlign::Center.as_css(), "center");
        assert_eq!(CellAlign::Right.as_css(), "right");
    }

    #[test]
    fn test_cell_vertical_align() {
        assert_eq!(CellVerticalAlign::Top.as_css(), "top");
        assert_eq!(CellVerticalAlign::Middle.as_css(), "middle");
        assert_eq!(CellVerticalAlign::Bottom.as_css(), "bottom");
    }

    #[test]
    fn test_numeric_format() {
        let pct = NumericFormat::percentage();
        assert_eq!(pct.kind, NumericFormatKind::Percentage);

        let currency = NumericFormat::currency("$");
        assert_eq!(currency.kind, NumericFormatKind::Currency);
        assert_eq!(currency.symbol, Some("$".to_string()));
    }
}
