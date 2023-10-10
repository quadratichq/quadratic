use serde::{Deserialize, Serialize};
use strum_macros::Display;
use wasm_bindgen::prelude::wasm_bindgen;

use super::CellRef;
use crate::{error, ArraySize, CellValue, Error, Value};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCellValue {
    pub language: CodeCellLanguage,
    pub code_string: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,
    pub last_modified: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<CodeCellRunOutput>,
}
impl CodeCellValue {
    pub fn get_output_value(&self, x: u32, y: u32) -> Option<CellValue> {
        match &self.output.as_ref()?.output_value()? {
            Value::Single(v) => Some(v.clone()),
            Value::Array(a) => Some(a.get(x, y).ok()?.clone()),
        }
    }

    pub fn output_size(&self) -> ArraySize {
        match self.output.as_ref().and_then(|out| out.output_value()) {
            Some(Value::Array(a)) => a.size(),
            Some(Value::Single(_)) | None => ArraySize::_1X1,
        }
    }

    pub fn get_error(&self) -> Option<Error> {
        let error = &self.output.as_ref()?.result;
        if let CodeCellRunResult::Err { error } = error {
            Some(error.clone())
        } else {
            None
        }
    }
}

#[derive(Serialize, Deserialize, Display, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[wasm_bindgen]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    Python,
    Formula,
    JavaScript,
    Sql,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCellRunOutput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,
    pub result: CodeCellRunResult,
}
impl CodeCellRunOutput {
    /// Returns the value (single cell or array) outputted by the code run if it
    /// succeeded, or `None` if it failed or has never been run.
    pub fn output_value(&self) -> Option<&Value> {
        self.result.output_value()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum CodeCellRunResult {
    Ok {
        output_value: Value,
        cells_accessed: Vec<CellRef>,
    },
    Err {
        error: Error,
    },
}
impl CodeCellRunResult {
    /// Returns the value (single cell or array) outputted by the code run if it
    /// succeeded, or `None` if it failed.
    pub fn output_value(&self) -> Option<&Value> {
        match self {
            Self::Ok { output_value, .. } => Some(output_value),
            Self::Err { .. } => None,
        }
    }
    /// Returns whether the code cell run succeeded.
    pub fn is_ok(&self) -> bool {
        match self {
            CodeCellRunResult::Ok { .. } => true,
            CodeCellRunResult::Err { .. } => false,
        }
    }
}
