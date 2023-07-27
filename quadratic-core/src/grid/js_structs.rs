use serde::{Deserialize, Serialize};

use super::column::BoolSummary;
use super::formatting::{CellAlign, CellBorder, CellBorders, CellWrap, NumericFormat};
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
    pub borders: Option<CellBorders>, // TODO: remove (needed for exporting to old file format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub numeric_format: Option<NumericFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bold: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub italic: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_color: Option<String>, // TODO: remove (needed for exporting to old file format)

    #[serde(flatten)]
    pub value: CellValue,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsRenderFill {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,

    pub color: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsRenderBorder {
    pub x: i64,
    pub y: i64,
    pub w: Option<u32>,
    pub h: Option<u32>,
    pub style: CellBorder,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct JsFormattingSummary {
    pub bold: BoolSummary,
    pub italic: BoolSummary,
}
