use serde::{Deserialize, Serialize};

use super::CellValue;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsRenderCellsArray {
    pub columns: Vec<Vec<JsRenderCellsBlock>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub struct JsRenderCellsBlock {
    pub start: i64,
    pub values: Vec<String>,
}
