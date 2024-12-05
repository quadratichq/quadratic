use serde::{Deserialize, Serialize};

use super::{
    CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, NumericFormatSchema, RenderSizeSchema,
};

pub type Contiguous2DSchema<T> = Vec<BlockSchema<Vec<BlockSchema<T>>>>;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct SheetFormattingSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub align: Contiguous2DSchema<Option<CellAlignSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub vertical_align: Contiguous2DSchema<Option<CellVerticalAlignSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub wrap: Contiguous2DSchema<Option<CellWrapSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_format: Contiguous2DSchema<Option<NumericFormatSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_decimals: Contiguous2DSchema<Option<i16>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub numeric_commas: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub bold: Contiguous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub italic: Contiguous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub text_color: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub fill_color: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub render_size: Contiguous2DSchema<Option<RenderSizeSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub date_time: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub underline: Contiguous2DSchema<bool>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub strike_through: Contiguous2DSchema<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BlockSchema<T> {
    pub start: u64,
    pub end: u64,
    pub value: T,
}
