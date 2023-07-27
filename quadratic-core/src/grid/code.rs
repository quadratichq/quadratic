use serde::{Deserialize, Serialize};

use super::{CellRef, CellValue};
use crate::formulas::{FormulaError, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CodeCellValue {
    pub language: CellCodeLanguage,
    pub code_string: String,
    pub formatted_code_string: Option<String>,
    pub last_modified: String,
    pub output: Option<CellCodeRunOutput>,
}
impl CodeCellValue {
    pub fn get(&self, x: u32, y: u32) -> Option<CellValue> {
        match &self.output.as_ref()?.result.as_ref().ok()?.output_value {
            Value::Single(v) => Some(v.clone().into()),
            Value::Array(a) => Some(a.get(x, y).ok()?.clone().into()),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellCodeLanguage {
    Python,
    Formula,
    JavaScript,
    Sql,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCodeRunOutput {
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub result: Result<CellCodeRunOk, FormulaError>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCodeRunOk {
    pub output_value: Value,
    pub cells_accessed: Vec<CellRef>,
}
