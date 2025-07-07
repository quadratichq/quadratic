//! Data structures for borders.

use std::hash::Hash;

use crate::color::Rgba;
use crate::small_timestamp::SmallTimestamp;
use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
pub enum BorderSelection {
    All,
    Inner,
    Outer,
    Horizontal,
    Vertical,
    Left,
    Top,
    Right,
    Bottom,
    Clear,
}

#[derive(
    Default,
    Serialize,
    Deserialize,
    Debug,
    Copy,
    Clone,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    Display,
    EnumString,
)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum CellBorderLine {
    #[default]
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,

    // this is needed to ensure that the border is cleared when compared to
    // neighbors or all, columns, rows
    Clear,
}

impl CellBorderLine {
    pub fn as_css_string(&self) -> &'static str {
        match self {
            CellBorderLine::Line1 => "1px solid",
            CellBorderLine::Line2 => "2px solid",
            CellBorderLine::Line3 => "3px solid",
            CellBorderLine::Dotted => "1px dashed",
            CellBorderLine::Dashed => "1px dotted",
            CellBorderLine::Double => "3px double",
            CellBorderLine::Clear => "0px solid",
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum BorderSide {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Default, Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct BorderStyle {
    pub color: Rgba,
    pub line: CellBorderLine,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct BorderStyleTimestamp {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub timestamp: SmallTimestamp,
}

impl BorderStyleTimestamp {
    pub fn new(color: Rgba, line: CellBorderLine) -> Self {
        BorderStyleTimestamp {
            color,
            line,
            timestamp: SmallTimestamp::now(),
        }
    }

    pub fn clear() -> Self {
        BorderStyleTimestamp {
            color: Rgba::default(),
            line: CellBorderLine::Clear,
            timestamp: SmallTimestamp::now(),
        }
    }

    /// If the style is clear, then returns None, otherwise returns the style.
    pub fn remove_clear(style: Option<BorderStyleTimestamp>) -> Option<BorderStyleTimestamp> {
        style.filter(|&style| style.line != CellBorderLine::Clear)
    }

    /// Returns true if the two styles are equal ignoring the timestamp.
    pub fn is_equal_ignore_timestamp(
        b1: Option<BorderStyleTimestamp>,
        b2: Option<BorderStyleTimestamp>,
    ) -> bool {
        match (b1, b2) {
            (None, None) => true,
            (Some(b1), Some(b2)) => b1.color == b2.color && b1.line == b2.line,
            _ => false,
        }
    }
}

impl From<BorderStyle> for BorderStyleTimestamp {
    fn from(border_style: BorderStyle) -> Self {
        BorderStyleTimestamp {
            color: border_style.color,
            line: border_style.line,
            timestamp: SmallTimestamp::now(),
        }
    }
}

impl From<BorderStyleTimestamp> for BorderStyle {
    fn from(border_style: BorderStyleTimestamp) -> Self {
        BorderStyle {
            color: border_style.color,
            line: border_style.line,
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct BorderStyleCell {
    pub top: Option<BorderStyleTimestamp>,
    pub bottom: Option<BorderStyleTimestamp>,
    pub left: Option<BorderStyleTimestamp>,
    pub right: Option<BorderStyleTimestamp>,
}
impl BorderStyleCell {
    #[cfg(test)]
    pub fn all() -> Self {
        BorderStyleCell {
            top: Some(BorderStyleTimestamp::default()),
            bottom: Some(BorderStyleTimestamp::default()),
            left: Some(BorderStyleTimestamp::default()),
            right: Some(BorderStyleTimestamp::default()),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.top.is_none() && self.bottom.is_none() && self.left.is_none() && self.right.is_none()
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsBorder {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub w: Option<i64>,
    pub h: Option<i64>,
    pub side: BorderSide,
    pub time_stamp: i64,
}

impl JsBorder {
    #[cfg(test)]
    pub fn compare_without_timestamp(&self, other: &Self) -> bool {
        self.x == other.x
            && self.y == other.y
            && self.w == other.w
            && self.h == other.h
            && self.side == other.side
            && self.color == other.color
            && self.line == other.line
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsBorderHorizontal {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub width: Option<i64>,

    // whether there are unbounded horizontal lines below this
    pub unbounded: bool,
}

impl JsBorderHorizontal {
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.x += x;
        self.y += y;
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsBorderVertical {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub height: Option<i64>,

    // whether there are unbounded vertical lines to the right
    pub unbounded: bool,
}

impl JsBorderVertical {
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.x += x;
        self.y += y;
    }
}

#[derive(Default, Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsBordersSheet {
    pub horizontal: Option<Vec<JsBorderHorizontal>>,
    pub vertical: Option<Vec<JsBorderVertical>>,
}
