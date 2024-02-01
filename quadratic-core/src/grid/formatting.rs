use std::fmt;
use std::ops::{BitOr, BitOrAssign};

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};

use crate::RunLengthEncoding;

use super::{block::SameValue, Column, ColumnData};

/// Array of a single cell formatting attribute.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellFmtArray {
    Align(RunLengthEncoding<Option<CellAlign>>),
    Wrap(RunLengthEncoding<Option<CellWrap>>),
    NumericFormat(RunLengthEncoding<Option<NumericFormat>>),
    NumericDecimals(RunLengthEncoding<Option<i16>>),
    NumericCommas(RunLengthEncoding<Option<bool>>),
    Bold(RunLengthEncoding<Option<bool>>),
    Italic(RunLengthEncoding<Option<bool>>),
    TextColor(RunLengthEncoding<Option<String>>),
    FillColor(RunLengthEncoding<Option<String>>),
    RenderSize(RunLengthEncoding<Option<RenderSize>>),
}

/// Cell formatting attribute.
pub trait CellFmtAttr {
    type Value: Serialize + for<'d> Deserialize<'d> + fmt::Debug + Clone + Eq;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>>;
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>>;
}

impl CellFmtAttr for CellAlign {
    type Value = Self;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.align
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.align
    }
}
impl CellFmtAttr for CellWrap {
    type Value = Self;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.wrap
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.wrap
    }
}
impl CellFmtAttr for NumericFormat {
    type Value = Self;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.numeric_format
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.numeric_format
    }
}
pub struct NumericDecimals;
impl CellFmtAttr for NumericDecimals {
    type Value = i16;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.numeric_decimals
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.numeric_decimals
    }
}

pub struct NumericCommas;
impl CellFmtAttr for NumericCommas {
    type Value = bool;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.numeric_commas
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.numeric_commas
    }
}

pub struct Bold;
impl CellFmtAttr for Bold {
    type Value = bool;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.bold
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.bold
    }
}
pub struct Italic;
impl CellFmtAttr for Italic {
    type Value = bool;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.italic
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.italic
    }
}
pub struct TextColor;
impl CellFmtAttr for TextColor {
    type Value = String;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.text_color
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.text_color
    }
}
pub struct FillColor;
impl CellFmtAttr for FillColor {
    type Value = String;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.fill_color
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.fill_color
    }
}

impl CellFmtAttr for RenderSize {
    type Value = Self;
    fn column_data_ref(column: &Column) -> &ColumnData<SameValue<Self::Value>> {
        &column.render_size
    }
    fn column_data_mut(column: &mut Column) -> &mut ColumnData<SameValue<Self::Value>> {
        &mut column.render_size
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub enum CellAlign {
    Center,
    Left,
    Right,
}

#[derive(
    Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash, Display, EnumString,
)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub enum CellWrap {
    #[default]
    Overflow,
    Wrap,
    Clip,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct NumericFormat {
    #[serde(rename = "type")]
    pub kind: NumericFormatKind,
    pub symbol: Option<String>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
/// Measures DOM element size in pixels.
pub struct RenderSize {
    pub w: String,
    pub h: String,
}

#[derive(
    Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, Display, EnumString, Copy,
)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "UPPERCASE")]
#[strum(ascii_case_insensitive)]
pub enum NumericFormatKind {
    #[default]
    Number,
    Currency, // { symbol: String }, // TODO: would be nice if this were just a single char (and it could be)
    Percentage,
    Exponential,
}

/// Whether a set of booleans has any `true` values and/or any `false` values.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct BoolSummary {
    /// Whether any values are true.
    pub is_any_true: bool,
    /// Whether any values are false.
    pub is_any_false: bool,
}
impl BitOr for BoolSummary {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        BoolSummary {
            is_any_true: self.is_any_true | rhs.is_any_true,
            is_any_false: self.is_any_false | rhs.is_any_false,
        }
    }
}
impl BitOrAssign for BoolSummary {
    fn bitor_assign(&mut self, rhs: Self) {
        *self = *self | rhs;
    }
}
