use serde::{Deserialize, Serialize};

use super::{
    CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, NumericFormatSchema, RenderSizeSchema,
};

pub type Continuous2DSchema<T> = Vec<(i64, BlockSchema<Vec<(i64, BlockSchema<T>)>>)>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct SheetFormattingSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub align: Continuous2DSchema<CellAlignSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub vertical_align: Continuous2DSchema<CellVerticalAlignSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub wrap: Continuous2DSchema<CellWrapSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_format: Continuous2DSchema<NumericFormatSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_decimals: Continuous2DSchema<i16>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_commas: Continuous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub bold: Continuous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub italic: Continuous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub text_color: Continuous2DSchema<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub fill_color: Continuous2DSchema<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub render_size: Continuous2DSchema<RenderSizeSchema>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub date_time: Continuous2DSchema<String>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub underline: Continuous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub strike_through: Continuous2DSchema<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BlockSchema<T> {
    pub start: i64,
    pub end: i64,
    pub value: T,
}
