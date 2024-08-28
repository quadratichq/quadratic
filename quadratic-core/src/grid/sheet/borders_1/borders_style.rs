use crate::color::Rgba;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, TS)]
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

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
pub enum CellBorderLine {
    Line1,
    Line2,
    Line3,
    Dotted,
    Dashed,
    Double,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, TS)]
pub struct JsBorderStyle {
    pub color: Rgba,
    pub line: CellBorderLine,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub struct BorderStyle {
    pub color: Rgba,
    pub line: CellBorderLine,
    pub timestamp: u32,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, Copy)]
pub struct BorderStyleCell {
    pub top: Option<BorderStyle>,
    pub bottom: Option<BorderStyle>,
    pub left: Option<BorderStyle>,
    pub right: Option<BorderStyle>,
}
