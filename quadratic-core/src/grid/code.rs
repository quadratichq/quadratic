use serde::{Deserialize, Serialize};

use super::CellRef;
use crate::formulas::{FormulaError, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCode {
    language: CellCodeLanguage,
    code_string: String,
    formatted_code_string: Option<String>,
    output: Option<CellCodeRunOutput>,
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
    std_out: Option<String>,
    std_err: Option<String>,
    result: Result<CellCodeRunOk, FormulaError>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCodeRunOk {
    output_value: Value,
    cells_accessed: Vec<CellRef>,
}
