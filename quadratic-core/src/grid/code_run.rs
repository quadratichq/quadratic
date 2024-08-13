//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.code_runs. CodeRun is optional within sheet.code_runs for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::{ArraySize, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetPos, SheetRect, Value};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use strum_macros::Display;
use wasm_bindgen::{convert::IntoWasmAbi, JsValue};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeRun {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,

    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: HashSet<SheetRect>,
    pub result: CodeRunResult,
    pub return_type: Option<String>,
    pub spill_error: bool,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
    pub last_modified: DateTime<Utc>,
}

impl CodeRun {
    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns [`CellValue::Blank`]. Note: this assumes a [`CellValue::Code`] exists at the location.
    pub fn cell_value_at(&self, x: u32, y: u32) -> Option<CellValue> {
        if self.spill_error {
            Some(CellValue::Blank)
        } else {
            self.cell_value_ref_at(x, y).cloned()
        }
    }

    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns `None`. Note: this assumes a [`CellValue::Code`] exists at the location.
    pub fn cell_value_ref_at(&self, x: u32, y: u32) -> Option<&CellValue> {
        if self.spill_error {
            None
        } else {
            self.result.as_std_ref().ok()?.get(x, y).ok()
        }
    }

    /// Returns the cell value at a relative location (0-indexed) into the code
    /// run output, for use when a formula references a cell.
    pub fn get_cell_for_formula(&self, x: u32, y: u32) -> CellValue {
        if self.spill_error {
            CellValue::Blank
        } else {
            match &self.result {
                CodeRunResult::Ok(value) => match value {
                    Value::Single(v) => v.clone(),
                    Value::Array(a) => a.get(x, y).cloned().unwrap_or(CellValue::Blank),
                    Value::Tuple(_) => CellValue::Error(Box::new(
                        RunErrorMsg::InternalError("tuple saved as code run result".into())
                            .without_span(),
                    )), // should never happen
                },
                CodeRunResult::Err(e) => CellValue::Error(Box::new(e.clone())),
            }
        }
    }

    /// Returns the size of the output array, or defaults to `_1X1` (since output always includes the code_cell).
    /// Note: this does not take spill_error into account.
    pub fn output_size(&self) -> ArraySize {
        match &self.result {
            CodeRunResult::Ok(Value::Array(a)) => a.size(),
            CodeRunResult::Ok(Value::Single(_) | Value::Tuple(_)) | CodeRunResult::Err(_) => {
                ArraySize::_1X1
            }
        }
    }

    pub fn is_html(&self) -> bool {
        if let Some(code_cell_value) = self.cell_value_at(0, 0) {
            code_cell_value.is_html()
        } else {
            false
        }
    }

    pub fn is_image(&self) -> bool {
        if let Some(code_cell_value) = self.cell_value_at(0, 0) {
            code_cell_value.is_image()
        } else {
            false
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_sheet_rect(&self, sheet_pos: SheetPos, ignore_spill: bool) -> SheetRect {
        if !ignore_spill && self.spill_error {
            SheetRect::from_sheet_pos_and_size(sheet_pos, ArraySize::_1X1)
        } else {
            SheetRect::from_sheet_pos_and_size(sheet_pos, self.output_size())
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_rect(&self, pos: Pos, ignore_spill: bool) -> Rect {
        if !ignore_spill && self.spill_error {
            Rect::from_pos_and_size(pos, ArraySize::_1X1)
        } else {
            Rect::from_pos_and_size(pos, self.output_size())
        }
    }

    /// Returns any error in a code run.
    pub fn get_error(&self) -> Option<RunError> {
        match &self.result {
            CodeRunResult::Ok { .. } => None,
            CodeRunResult::Err(error) => Some(error.to_owned()),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    Python,
    Formula,
    Connection { kind: ConnectionKind, id: String },
    Javascript,
}

#[derive(Serialize, Deserialize, Display, Copy, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "UPPERCASE")]
pub enum ConnectionKind {
    Postgres,
    Mysql,
    Mssql,
}

impl wasm_bindgen::describe::WasmDescribe for ConnectionKind {
    fn describe() {
        JsValue::describe();
    }
}

impl wasm_bindgen::convert::IntoWasmAbi for ConnectionKind {
    type Abi = <JsValue as IntoWasmAbi>::Abi;

    fn into_abi(self) -> Self::Abi {
        serde_wasm_bindgen::to_value(&self)
            .unwrap_or("Formula".into())
            .into_abi()
    }
}

/// Custom version of [`std::result::Result`] that serializes the way we want.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum CodeRunResult {
    Ok(Value),
    Err(RunError),
}
impl CodeRunResult {
    /// Converts into a [`std::result::Result`] by value.
    pub fn into_std(self) -> Result<Value, RunError> {
        match self {
            CodeRunResult::Ok(v) => Ok(v),
            CodeRunResult::Err(e) => Err(e),
        }
    }
    /// Converts into a [`std::result::Result`] by reference.
    pub fn as_std_ref(&self) -> Result<&Value, &RunError> {
        match self {
            CodeRunResult::Ok(v) => Ok(v),
            CodeRunResult::Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{grid::SheetId, Array};
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_output_size() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Number(1.into()))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            spill_error: false,
            last_modified: Utc::now(),
        };
        assert_eq!(code_run.output_size(), ArraySize::_1X1);
        assert_eq!(
            code_run.output_sheet_rect(
                SheetPos {
                    x: -1,
                    y: -2,
                    sheet_id
                },
                false
            ),
            SheetRect::from_numbers(-1, -2, 1, 1, sheet_id)
        );

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Array(Array::new_empty(
                ArraySize::new(10, 11).unwrap(),
            ))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            spill_error: false,
            last_modified: Utc::now(),
        };
        assert_eq!(code_run.output_size().w.get(), 10);
        assert_eq!(code_run.output_size().h.get(), 11);
        assert_eq!(
            code_run.output_sheet_rect(
                SheetPos {
                    x: 1,
                    y: 2,
                    sheet_id
                },
                false
            ),
            SheetRect::from_numbers(1, 2, 10, 11, sheet_id)
        );
    }

    #[test]
    #[parallel]
    fn test_output_sheet_rect_spill_error() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
            formatted_code_string: None,
            std_out: None,
            std_err: None,
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Array(Array::new_empty(
                ArraySize::new(10, 11).unwrap(),
            ))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            spill_error: true,
            last_modified: Utc::now(),
        };
        assert_eq!(code_run.output_size().w.get(), 10);
        assert_eq!(code_run.output_size().h.get(), 11);
        assert_eq!(
            code_run.output_sheet_rect(
                SheetPos {
                    x: 1,
                    y: 2,
                    sheet_id
                },
                false
            ),
            SheetRect::from_numbers(1, 2, 1, 1, sheet_id)
        );
        assert_eq!(
            code_run.output_sheet_rect(
                SheetPos {
                    x: 1,
                    y: 2,
                    sheet_id
                },
                true
            ),
            SheetRect::from_numbers(1, 2, 10, 11, sheet_id)
        );
    }
}
