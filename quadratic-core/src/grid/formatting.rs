use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum CellAlign {
    Center,
    Left,
    Right,
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum CellWrap {
    #[default]
    Overflow,
    Wrap,
    Clip,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct NumericFormat {
    #[serde(flatten)]
    kind: NumericFormatKind,
    #[serde(rename = "decimalPlaces")]
    decimals: Option<u32>,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(tag = "type")]
pub enum NumericFormatKind {
    Number,
    Currency { symbol: String }, // TODO: would be nice if this were just a single char (and it could be)
    Percentage,
    Exponential,
}
