use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use wasm_bindgen::prelude::wasm_bindgen;

use super::CellRef;
use crate::{ArraySize, CellValue, Error, Pos, Rect, Value};

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

    // todo: output_size outputs a 1x1 for output == None. That seems wrong
    pub fn output_size(&self) -> ArraySize {
        match self.output.as_ref().and_then(|out| out.output_value()) {
            Some(Value::Array(a)) => a.size(),
            Some(Value::Single(_)) | None => ArraySize::_1X1,
        }
    }

    /// returns a Rect for the output of the code cell if it is an array
    pub fn output_rect(&self) -> Option<Rect> {
        self.output.as_ref().is_some().then(|| {
            let array_size = self.output_size();
            Rect {
                min: Pos { x: 0, y: 0 },
                max: Pos {
                    x: array_size.w.get() as i64,
                    y: array_size.h.get() as i64,
                },
            }
        })
    }

    pub fn spill_error(&self) -> bool {
        self.output.as_ref().map(|out| out.spill).unwrap_or(false)
    }

    pub fn cells_accessed_copy(&self) -> Option<Vec<CellRef>> {
        self.output.as_ref()?.cells_accessed().cloned()
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

#[derive(Serialize, Deserialize, Display, Debug, Copy, Clone, PartialEq, Eq, Hash, EnumString)]
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
    #[serde(default)]
    pub spill: bool,
}
impl CodeCellRunOutput {
    /// Returns the value (single cell or array) outputted by the code run if it
    /// succeeded, or `None` if it failed or has never been run.
    pub fn output_value(&self) -> Option<&Value> {
        self.result.output_value()
    }

    pub fn cells_accessed(&self) -> Option<&Vec<CellRef>> {
        match &self.result {
            CodeCellRunResult::Ok { cells_accessed, .. } => Some(cells_accessed),
            CodeCellRunResult::Err { .. } => None,
        }
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

#[cfg(test)]
mod test {
    use crate::{
        grid::{CodeCellRunOutput, CodeCellValue},
        Array, ArraySize, Pos, Rect,
    };

    #[test]
    fn test_output_size() {
        let code_cell = CodeCellValue {
            language: super::CodeCellLanguage::Python,
            code_string: "1".to_string(),
            formatted_code_string: None,
            last_modified: "1".to_string(),
            output: None,
        };
        assert_eq!(code_cell.output_size(), super::ArraySize::_1X1);
        assert_eq!(code_cell.output_rect(), None);

        let code_cell = CodeCellValue {
            language: super::CodeCellLanguage::Python,
            code_string: "1".to_string(),
            formatted_code_string: None,
            last_modified: "1".to_string(),
            output: Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: super::CodeCellRunResult::Ok {
                    output_value: crate::Value::Array(Array::new_empty(
                        ArraySize::new(10, 11).unwrap(),
                    )),
                    cells_accessed: vec![],
                },
                spill: false,
            }),
        };
        assert_eq!(code_cell.output_size().w.get(), 10);
        assert_eq!(code_cell.output_size().h.get(), 11);
        assert_eq!(
            code_cell.output_rect(),
            Some(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 10, y: 11 }))
        );
    }
}
