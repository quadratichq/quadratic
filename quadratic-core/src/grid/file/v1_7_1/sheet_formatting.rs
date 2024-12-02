use serde::{Deserialize, Serialize};

use super::{
    CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, NumericFormatSchema, RenderSizeSchema,
};

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct SheetFormattingSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub align: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<CellAlignSchema>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub vertical_align: Vec<(
        i64,
        BlockSchema<Vec<(i64, BlockSchema<CellVerticalAlignSchema>)>>,
    )>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub wrap: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<CellWrapSchema>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_format: Vec<(
        i64,
        BlockSchema<Vec<(i64, BlockSchema<NumericFormatSchema>)>>,
    )>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_decimals: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<i16>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_commas: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<bool>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub bold: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<bool>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub italic: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<bool>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub text_color: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<String>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub fill_color: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<String>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub render_size: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<RenderSizeSchema>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub date_time: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<String>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub underline: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<bool>)>>)>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub strike_through: Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<bool>)>>)>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BlockSchema<T> {
    pub start: i64,
    pub end: i64,
    pub value: T,
}
