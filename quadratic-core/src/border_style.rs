use std::collections::HashMap;

#[cfg(feature = "js")]
use crate::color::Rgba;
use crate::small_timestamp::SmallTimestamp;
use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
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
    TS,
)]
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
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
pub struct BorderStyle {
    pub color: Rgba,
    pub line: CellBorderLine,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, TS)]
pub struct BorderStyleTimestamp {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub timestamp: SmallTimestamp,
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

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, TS)]
pub struct BorderStyleCell {
    pub top: Option<BorderStyleTimestamp>,
    pub bottom: Option<BorderStyleTimestamp>,
    pub left: Option<BorderStyleTimestamp>,
    pub right: Option<BorderStyleTimestamp>,
}

impl From<BorderStyleCell> for BorderStyleCellUpdate {
    fn from(cell: BorderStyleCell) -> Self {
        BorderStyleCellUpdate {
            top: cell.top.map(|ts| ts.into()),
            bottom: cell.bottom.map(|ts| ts.into()),
            left: cell.left.map(|ts| ts.into()),
            right: cell.right.map(|ts| ts.into()),
        }
    }
}

impl BorderStyleCell {
    /// Apply an update to the cell.
    /// Returns the original cell so it can be used for undo.
    pub fn apply_update(&mut self, update: &BorderStyleCellUpdate) -> BorderStyleCellUpdate {
        let original = self.clone().into();
        if let Some(top) = update.top {
            self.top = top;
        }
        if let Some(bottom) = update.bottom {
            self.bottom = bottom;
        }
        if let Some(left) = update.left {
            self.left = left;
        }
        if let Some(right) = update.right {
            self.right = right;
        }
        original
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct BorderStyleCellUpdate {
    pub top: Option<Option<BorderStyleTimestamp>>,
    pub bottom: Option<Option<BorderStyleTimestamp>>,
    pub left: Option<Option<BorderStyleTimestamp>>,
    pub right: Option<Option<BorderStyleTimestamp>>,
}

impl BorderStyleCellUpdate {
    pub fn clear() -> Self {
        BorderStyleCellUpdate {
            top: Some(None),
            bottom: Some(None),
            left: Some(None),
            right: Some(None),
        }
    }

    /// Create a cell with a complete border on all sides.
    #[cfg(test)]
    pub fn all() -> Self {
        BorderStyleCellUpdate {
            top: Some(Some(BorderStyleTimestamp::default())),
            bottom: Some(Some(BorderStyleTimestamp::default())),
            left: Some(Some(BorderStyleTimestamp::default())),
            right: Some(Some(BorderStyleTimestamp::default())),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorderHorizontal {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub width: i64,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorderVertical {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub x: i64,
    pub y: i64,
    pub height: i64,
}

#[derive(Default, Serialize, Deserialize, Debug, PartialEq, Eq, TS)]
pub struct JsBorders {
    pub hash_x: i64,
    pub hash_y: i64,
    pub horizontal: Vec<JsBorderHorizontal>,
    pub vertical: Vec<JsBorderVertical>,
}

impl JsBorders {
    pub fn is_empty(&self) -> bool {
        self.horizontal.is_empty() && self.vertical.is_empty()
    }
}

#[derive(Default, Serialize, Deserialize, Debug, TS)]
pub struct JsBordersSheet {
    pub all: BorderStyleCell,
    pub columns: HashMap<i64, BorderStyleCell>,
    pub rows: HashMap<i64, BorderStyleCell>,

    // if None is sent, then ignore cells (used when sheet borders changed--we don't need to send all cells again)
    pub hashes: Option<Vec<JsBorders>>,
}
