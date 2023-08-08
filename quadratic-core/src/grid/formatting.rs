use std::ops::{BitOr, BitOrAssign};

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), ts(export))]
#[serde(rename_all = "camelCase")]
pub enum CellAlign {
    Center,
    Left,
    Right,
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), ts(export))]
#[serde(rename_all = "camelCase")]
pub enum CellWrap {
    #[default]
    Overflow,
    Wrap,
    Clip,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), ts(export))]
pub struct NumericFormat {
    kind: NumericFormatKind,
    #[serde(rename = "decimalPlaces")]
    decimals: Option<u32>,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), ts(export))]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(tag = "type")]
pub enum NumericFormatKind {
    Number,
    Currency { symbol: String }, // TODO: would be nice if this were just a single char (and it could be)
    Percentage,
    Exponential,
}

/// Whether a set of booleans has any `true` values and/or any `false` values.
#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), ts(export))]
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
