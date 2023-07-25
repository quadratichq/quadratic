use serde::{Deserialize, Serialize};

use super::formatting::{CellAlign, CellWrap, NumericFormat};
use super::CellValue;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JsRenderCell {
    pub x: i64,
    pub y: i64,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub align: Option<CellAlign>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap: Option<CellWrap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub numeric_format: Option<NumericFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,

    #[serde(flatten)]
    pub value: CellValue,
}
