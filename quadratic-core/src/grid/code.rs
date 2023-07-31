use serde::{Deserialize, Serialize};

use super::{legacy, CellRef, CellValue};
use crate::formulas::{ArraySize, FormulaError, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CodeCellValue {
    pub language: CellCodeLanguage,
    pub code_string: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,
    pub last_modified: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<CellCodeRunOutput>,
}
impl CodeCellValue {
    pub fn get_output_value(&self, x: u32, y: u32) -> Option<CellValue> {
        match &self.output.as_ref()?.result.as_ref().ok()?.output_value {
            Value::Single(v) => Some(v.clone().into()),
            Value::Array(a) => Some(a.get(x, y).ok()?.clone().into()),
        }
    }

    pub fn js_evaluation_result(&self) -> Option<legacy::JsCellEvalResult> {
        self.output.as_ref().map(|output| {
            let mut output_value = None;
            let mut array_output = None;
            if let Ok(result) = &output.result {
                match &result.output_value {
                    Value::Single(value) => {
                        output_value = Some(value.to_string());
                    }
                    Value::Array(array) => {
                        array_output = Some(legacy::JsArrayOutput::Block(
                            array
                                .basic_values_slice()
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
        match &self.output {
            Some(output) => match &output.result {
                Ok(ok) => match &ok.output_value {
                    Value::Single(_) => ArraySize { w: 1, h: 1 },
                    Value::Array(a) => a.array_size(),
                },
                Err(_) => ArraySize { w: 1, h: 1 },
            },
            None => ArraySize { w: 1, h: 1 },
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,
    pub result: Result<CellCodeRunOk, FormulaError>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCodeRunOk {
    pub output_value: Value,
    pub cells_accessed: Vec<CellRef>,
}
