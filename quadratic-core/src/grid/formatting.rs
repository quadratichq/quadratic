// todo: maybe delete this file?

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

use crate::RunLengthEncoding;

pub struct NumericDecimals;

pub struct NumericCommas;

pub struct Bold;
pub struct Italic;
pub struct TextColor;
pub struct FillColor;
pub struct Underline;
pub struct StrikeThrough;

// TODO(ddimaria): deprecated, can be removed once SetCellFormatsSelection is removed 12/2024
#[derive(Default, Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct RenderSize {
    pub w: String,
    pub h: String,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[serde(rename_all = "camelCase")]
pub enum CellAlign {
    Center,
    Left,
    Right,
}

impl CellAlign {
    pub fn as_css_string(&self) -> &'static str {
        match self {
            CellAlign::Center => "text-align: center;",
            CellAlign::Left => "text-align: left;",
            CellAlign::Right => "text-align: right;",
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[serde(rename_all = "camelCase")]
pub enum CellVerticalAlign {
    Top,
    Middle,
    Bottom,
}

impl CellVerticalAlign {
    pub fn as_css_string(&self) -> &'static str {
        match self {
            CellVerticalAlign::Top => "vertical-align: top;",
            CellVerticalAlign::Middle => "vertical-align: middle;",
            CellVerticalAlign::Bottom => "vertical-align: bottom;",
        }
    }
}

#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString,
)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[serde(rename_all = "camelCase")]
pub enum CellWrap {
    #[default]
    Overflow,
    Wrap,
    Clip,
}

impl CellWrap {
    pub fn as_css_string(&self) -> &'static str {
        match self {
            CellWrap::Overflow => "overflow: visible; white-space: nowrap;",
            CellWrap::Wrap => "overflow: hidden; white-space: normal; word-wrap: break-word;",
            CellWrap::Clip => "overflow: hidden; white-space: clip;",
        }
    }
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct NumericFormat {
    #[serde(rename = "type")]
    pub kind: NumericFormatKind,
    pub symbol: Option<String>,
}

impl NumericFormat {
    /// Returns a NumericFormat with the kind set to Percentage.
    pub fn percentage() -> Self {
        Self {
            kind: NumericFormatKind::Percentage,
            symbol: None,
        }
    }

    /// Returns a NumericFormat with the kind set to Number.
    pub fn number() -> Self {
        Self {
            kind: NumericFormatKind::Number,
            symbol: None,
        }
    }
}

#[derive(
    Default, Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString,
)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[serde(rename_all = "UPPERCASE")]
#[strum(ascii_case_insensitive)]
pub enum NumericFormatKind {
    #[default]
    Number,
    Currency, // { symbol: String }, // TODO: would be nice if this were just a single char (and it could be)
    Percentage,
    Exponential,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct DateTimeFormatting;

// keep around for backwards compatibility
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellFmtArray {
    Align(RunLengthEncoding<Option<CellAlign>>),
    VerticalAlign(RunLengthEncoding<Option<CellVerticalAlign>>),
    Wrap(RunLengthEncoding<Option<CellWrap>>),
    NumericFormat(RunLengthEncoding<Option<NumericFormat>>),
    NumericDecimals(RunLengthEncoding<Option<i16>>),
    NumericCommas(RunLengthEncoding<Option<bool>>),
    Bold(RunLengthEncoding<Option<bool>>),
    Italic(RunLengthEncoding<Option<bool>>),
    TextColor(RunLengthEncoding<Option<String>>),
    FillColor(RunLengthEncoding<Option<String>>),
    RenderSize(RunLengthEncoding<Option<RenderSize>>),
    DateTime(RunLengthEncoding<Option<String>>),
    Underline(RunLengthEncoding<Option<bool>>),
    StrikeThrough(RunLengthEncoding<Option<bool>>),
}
