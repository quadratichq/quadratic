use serde::{Deserialize, Serialize};
use std::borrow::Cow;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

/// Contents of a single spreadsheet cell.
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub enum Cell {
    #[default]
    Empty,
    Int(i64),
    Text(String),
}
impl Cell {
    pub fn is_empty(&self) -> bool {
        matches!(self, Self::Empty)
    }

    pub fn string_value(&self) -> Cow<'_, str> {
        match self {
            Cell::Empty => "".into(),
            Cell::Int(i) => i.to_string().into(),
            Cell::Text(s) => s.into(),
        }
    }
}

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
#[cfg_attr(feature = "js", wasm_bindgen)]
pub enum CellTypes {
    #[default]
    Text,
    Formula,
    Javascript,
    Python,
    Sql,
    Computed,
}
