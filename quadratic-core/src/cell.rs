use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct JsCell {
    pub x: i64,
    pub y: i64,
    // pub r#type: CellTypes,
    pub value: String,

    pub dependent_cells: Option<Vec<[i64; 2]>>,

    pub python_code: Option<String>,
    pub python_output: Option<String>,

    pub array_cells: Option<Vec<[i64; 2]>>,

    pub last_modified: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Default, Copy, Clone, PartialEq)]
#[wasm_bindgen]
pub enum CellTypes {
    #[default]
    Text,
    Formula,
    Javascript,
    Python,
    Sql,
    Computed,
}
