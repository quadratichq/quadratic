use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{ArraySize, CellValue, Error, Pos, Rect, SheetPos, SheetRect, Value};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCellValue {
    pub language: CodeCellLanguage,
    pub code_string: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,
    // TODO(ddimaria): This should be a timestamp
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

    pub fn set_spill(&mut self, spill: bool) {
        if let Some(output) = &mut self.output {
            output.spill = spill;
        }
    }

    /// Returns the size of the output array, or defaults to `_1X1` (since output always includes the code_cell).
    /// Note: this does not take spill_error into account.
    pub fn output_size(&self) -> ArraySize {
        match self.output.as_ref().and_then(|out| out.output_value()) {
            Some(Value::Array(a)) => a.size(),
            Some(Value::Single(_)) | None => ArraySize::_1X1,
        }
    }

    pub fn is_html(&self) -> bool {
        if let Some(code_cell_value) = self.get_output_value(0, 0) {
            code_cell_value.is_html()
        } else {
            false
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_sheet_rect(&self, sheet_pos: SheetPos) -> SheetRect {
        if self.has_spill_error() {
            SheetRect::from_sheet_pos_and_size(sheet_pos, ArraySize::_1X1)
        } else {
            SheetRect::from_sheet_pos_and_size(sheet_pos, self.output_size())
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_rect(&self, pos: Pos) -> Rect {
        if self.has_spill_error() {
            Rect::from_pos_and_size(pos, ArraySize::_1X1)
        } else {
            Rect::from_pos_and_size(pos, self.output_size())
        }
    }

    pub fn has_spill_error(&self) -> bool {
        self.output.as_ref().map(|out| out.spill).unwrap_or(false)
    }

    pub fn cells_accessed_copy(&self) -> Option<HashSet<SheetRect>> {
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

    pub fn cells_accessed(&self) -> Option<&HashSet<SheetRect>> {
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
        cells_accessed: HashSet<SheetRect>,
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
    use super::*;
    use crate::{grid::SheetId, Array};

    #[test]
    fn test_output_size() {
        let sheet_id = SheetId::new();
        let code_cell = CodeCellValue {
            language: super::CodeCellLanguage::Python,
            code_string: "1".to_string(),
            formatted_code_string: None,
            last_modified: "1".to_string(),
            output: None,
        };
        assert_eq!(code_cell.output_size(), super::ArraySize::_1X1);
        assert_eq!(
            code_cell.output_sheet_rect(SheetPos {
                x: -1,
                y: -2,
                sheet_id
            }),
            SheetRect::from_numbers(-1, -2, 1, 1, sheet_id)
        );

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
                    cells_accessed: HashSet::new(),
                },
                spill: false,
            }),
        };
        assert_eq!(code_cell.output_size().w.get(), 10);
        assert_eq!(code_cell.output_size().h.get(), 11);
        assert_eq!(
            code_cell.output_sheet_rect(SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }),
            SheetRect::from_numbers(1, 2, 10, 11, sheet_id)
        );
    }

    #[test]
    fn test_output_sheet_rect_spill_error() {
        let sheet_id = SheetId::new();
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
                    cells_accessed: HashSet::new(),
                },
                spill: true,
            }),
        };
        assert_eq!(code_cell.output_size().w.get(), 10);
        assert_eq!(code_cell.output_size().h.get(), 11);
        assert_eq!(
            code_cell.output_sheet_rect(SheetPos {
                x: 1,
                y: 2,
                sheet_id
            }),
            SheetRect::from_numbers(1, 2, 1, 1, sheet_id)
        );
    }
}
