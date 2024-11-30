use serde::{Deserialize, Serialize};

use super::{
    CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, NumericFormatSchema, RenderSizeSchema,
};

pub type SheetFormattingSchema = Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<FormatSchema>)>>)>;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct BlockSchema<T> {
    pub start: i64,
    pub end: i64,
    pub value: T,
}

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct FormatSchema {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub align: Option<CellAlignSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub vertical_align: Option<CellVerticalAlignSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub wrap: Option<CellWrapSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub numeric_format: Option<NumericFormatSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub numeric_decimals: Option<i16>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub numeric_commas: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub bold: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub italic: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub text_color: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fill_color: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub render_size: Option<RenderSizeSchema>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub date_time: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub underline: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub strike_through: Option<bool>,
}
