use serde::{Deserialize, Serialize};

use super::{
    CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, Contiguous2DSchema,
    NumericFormatSchema, RenderSizeSchema,
};

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub(crate) struct SheetFormattingSchema {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) align: Contiguous2DSchema<Option<CellAlignSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) vertical_align: Contiguous2DSchema<Option<CellVerticalAlignSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) wrap: Contiguous2DSchema<Option<CellWrapSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) numeric_format: Contiguous2DSchema<Option<NumericFormatSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) numeric_decimals: Contiguous2DSchema<Option<i16>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) numeric_commas: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) bold: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) italic: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) text_color: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) fill_color: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) render_size: Contiguous2DSchema<Option<RenderSizeSchema>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) date_time: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) underline: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) strike_through: Contiguous2DSchema<Option<bool>>,
}
