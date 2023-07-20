use serde::{Deserialize, Serialize};

use super::CellRef;
use crate::formulas::{FormulaError, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCode {
    pub language: CellCodeLanguage,
    pub code_string: String,
    pub formatted_code_string: Option<String>,
    pub last_modified: String,
    pub output: Option<CellCodeRunOutput>,
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
