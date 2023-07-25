use serde::{Deserialize, Serialize};

use super::formatting::{CellAlign, CellWrap};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsRenderCell {
    pub x: i64,
    pub y: i64,
    pub text: String,
    pub wrap: Option<CellWrap>,
    pub align: Option<CellAlign>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
}
