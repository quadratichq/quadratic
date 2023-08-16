use serde::{Deserialize, Serialize};

use super::{legacy, CellRef};
use crate::{ArraySize, CellValue, Error, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
            Value::Single(v) => Some(v.clone().into()),
            Value::Array(a) => Some(a.get(x, y).ok()?.clone().into()),
        }
    }

    pub fn js_evaluation_result(&self) -> Option<legacy::JsCellEvalResult> {
        self.output.as_ref().map(|output| {
            let mut output_value = None;
            let mut array_output = None;
            if let Some(out) = output.output_value() {
                match out {
                    Value::Single(value) => {
                        output_value = Some(value.to_string());
                    }
                    Value::Array(array) => {
                        array_output = Some(legacy::JsArrayOutput::Block(
                            array
                                .cell_values_slice()
                                .chunks(array.width() as usize)
                                .map(|row| {
                                    row.into_iter()
                                        .map(|cell| Some(legacy::Any::String(cell.to_string())))
                                        .collect()
                                })
                                .collect(),
                        ))
                    }
                }
            }
            legacy::JsCellEvalResult {
                success: output.result.is_ok(),
                std_out: output.std_out.clone(),
                std_err: output.std_err.clone(),
                output_value,
                cells_accessed: vec![], // TODO: cells accessed
                array_output,
                formatted_code: self.code_string.clone(),
                error_span: None,
            }
        })
    }

    pub fn output_size(&self) -> ArraySize {
        match self.output.as_ref().and_then(|out| out.output_value()) {
            Some(Value::Array(a)) => a.size(),
            Some(Value::Single(_)) | None => ArraySize::_1X1,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    Python,
    Formula,
    JavaScript,
    Sql,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
