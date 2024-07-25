#[cfg(feature = "js")]
use crate::color::Rgba;
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
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CellBorderLine {
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
// TODO: Causes weird shadowing problem in wasm-bindgen
// #[cfg_attr(feature = "js", wasm_bindgen)]
// impl CellBorderLine {
//     #[cfg_attr(feature = "js", wasm_bindgen(constructor))]
//     pub fn from_int(int_value: u8) -> Self {
//         int_value.try_into().unwrap_or(CellBorderLine::Line1)
//     }
// }
// impl TryFrom<u8> for CellBorderLine {
//     type Error = ();
//
//     fn try_from(value: u8) -> Result<Self, Self::Error> {
//         match value {
//             0 => Ok(Self::Line1),
//             1 => Ok(Self::Line2),
//             2 => Ok(Self::Line3),
//             3 => Ok(Self::Dotted),
//             4 => Ok(Self::Dashed),
//             5 => Ok(Self::Double),
//             _ => Err(()),
//         }
//     }
// }

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct BorderStyle {
    pub color: Rgba,
    pub line: CellBorderLine,
}
