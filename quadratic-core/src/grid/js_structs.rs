use serde::{Deserialize, Serialize};

use crate::formulas::BasicValue;

use super::formatting::{CellAlign, CellWrap, NumericFormat};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsCell {
    pub x: i64,
    pub y: i64,
    pub r#type: JsCellType,
    pub value: String,
    pub array_cells: Option<Vec<(i64, i64)>>,
    pub dependent_cells: Option<Vec<(i64, i64)>>,
    pub evaluation_result: Option<JsCellEvalResult>,
    pub formula_code: Option<String>,
    pub last_modified: Option<String>,
    pub ai_prompt: Option<String>,
    pub python_code: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JsCellType {
    Text,
    Formula,
    JavaScript,
    Python,
    Sql,
    Computed,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsCellEvalResult {
    pub success: bool,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub output_value: Option<String>,
    pub cells_accessed: Vec<(i64, i64)>,
    pub array_output: Option<JsArrayOutput>,
    pub formatted_code: String,
    pub error_span: Option<(u32, u32)>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum JsArrayOutput {
    Array(Vec<Option<Any>>),
    Block(Vec<Vec<Option<Any>>>),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JsCellFormat {
    pub x: i64,
    pub y: i64,
    pub alignment: Option<CellAlign>,
    pub bold: Option<bool>,
    pub fill_color: Option<String>,
    pub italic: Option<bool>,
    pub text_color: Option<String>,
    pub text_format: Option<NumericFormat>,
    pub wrapping: Option<CellWrap>, // default is overflow
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct JsCoordinate {
    pub x: i64,
    pub y: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum Any {
    Number(f64),
    String(String),
    Boolean(bool),
}
impl Into<BasicValue> for Any {
    fn into(self) -> BasicValue {
        match self {
            Any::Number(n) => BasicValue::Number(n),
            Any::String(s) => BasicValue::String(s),
            Any::Boolean(b) => BasicValue::Bool(b),
        }
    }
}
