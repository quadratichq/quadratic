use std::fmt;

#[cfg(test)]
use proptest::prelude::*;
use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

use super::Format;
use crate::RunLengthEncoding;

/// Array of a single cell formatting attribute.
///
/// TODO: this is NOT needed anymore. delete it.
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

/// Cell formatting attribute.
///
/// TODO: this is NOT needed anymore. delete it. replace the generic functions.
pub trait CellFmtAttr {
    type Value: Serialize + for<'d> Deserialize<'d> + fmt::Debug + Clone + Eq;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value>;
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value>;
}

impl CellFmtAttr for CellAlign {
    type Value = Self;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.align
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.align
    }
}
impl CellFmtAttr for CellVerticalAlign {
    type Value = Self;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.vertical_align
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.vertical_align
    }
}
impl CellFmtAttr for CellWrap {
    type Value = Self;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.wrap
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.wrap
    }
}
impl CellFmtAttr for NumericFormat {
    type Value = Self;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.numeric_format
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.numeric_format
    }
}
pub struct NumericDecimals;
impl CellFmtAttr for NumericDecimals {
    type Value = i16;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.numeric_decimals
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.numeric_decimals
    }
}

pub struct NumericCommas;
impl CellFmtAttr for NumericCommas {
    type Value = bool;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.numeric_commas
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.numeric_commas
    }
}

pub struct Bold;
impl CellFmtAttr for Bold {
    type Value = bool;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.bold
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.bold
    }
}
pub struct Italic;
impl CellFmtAttr for Italic {
    type Value = bool;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.italic
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.italic
    }
}
pub struct TextColor;
impl CellFmtAttr for TextColor {
    type Value = String;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.text_color
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.text_color
    }
}
pub struct FillColor;
impl CellFmtAttr for FillColor {
    type Value = String;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.fill_color
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.fill_color
    }
}

impl CellFmtAttr for RenderSize {
    type Value = Self;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.render_size
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.render_size
    }
}

pub struct Underline;
impl CellFmtAttr for Underline {
    type Value = bool;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.underline
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.underline
    }
}
pub struct StrikeThrough;
impl CellFmtAttr for StrikeThrough {
    type Value = bool;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.strike_through
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.strike_through
    }
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

#[derive(
    Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString, ts_rs::TS,
)]
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
    Serialize,
    Deserialize,
    Debug,
    Default,
    Copy,
    Clone,
    PartialEq,
    Eq,
    Hash,
    Display,
    EnumString,
    ts_rs::TS,
)]
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

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, ts_rs::TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct NumericFormat {
    #[serde(rename = "type")]
    pub kind: NumericFormatKind,
    pub symbol: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, ts_rs::TS)]
/// Measures DOM element size in pixels.
pub struct RenderSize {
    pub w: String,
    pub h: String,
}
#[cfg(test)]
impl Arbitrary for RenderSize {
    type Parameters = ();

    fn arbitrary_with(_args: Self::Parameters) -> Self::Strategy {
        (u8::arbitrary(), u8::arbitrary()).prop_map(|(w, h)| RenderSize {
            w: w.to_string(),
            h: h.to_string(),
        })
    }

    type Strategy = proptest::strategy::Map<
        (<u8 as Arbitrary>::Strategy, <u8 as Arbitrary>::Strategy),
        fn((u8, u8)) -> Self,
    >;
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
    Display,
    EnumString,
    ts_rs::TS,
)]
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

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, ts_rs::TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct DateTimeFormatting;
impl CellFmtAttr for DateTimeFormatting {
    type Value = String;
    fn get_from_format(fmt: &Format) -> &Option<Self::Value> {
        &fmt.date_time
    }
    fn get_from_format_mut(fmt: &mut Format) -> &mut Option<Self::Value> {
        &mut fmt.date_time
    }
}
