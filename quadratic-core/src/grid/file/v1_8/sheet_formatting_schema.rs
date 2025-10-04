use serde::{Deserialize, Serialize};

use super::{
    CellAlignSchema, CellVerticalAlignSchema, CellWrapSchema, Contiguous2DSchema,
    NumericFormatSchema,
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
    pub(crate) date_time: Contiguous2DSchema<Option<String>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) underline: Contiguous2DSchema<Option<bool>>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) strike_through: Contiguous2DSchema<Option<bool>>,
}

impl SheetFormattingSchema {
    pub(crate) fn is_empty(&self) -> bool {
        self.align.is_empty()
            && self.vertical_align.is_empty()
            && self.wrap.is_empty()
            && self.numeric_format.is_empty()
            && self.numeric_decimals.is_empty()
            && self.numeric_commas.is_empty()
            && self.bold.is_empty()
            && self.italic.is_empty()
            && self.text_color.is_empty()
            && self.fill_color.is_empty()
            && self.date_time.is_empty()
            && self.underline.is_empty()
            && self.strike_through.is_empty()
    }
}
