//! CodeRun is the output of a CellValue.is_code() type (eg, CellValue::Python)
//!
//! This lives in sheet.code_runs. CodeRun is optional within sheet.code_runs for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::{ArraySize, CellValue, Error, Pos, Rect, SheetPos, SheetRect, Value};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use strum_macros::{Display, EnumString};
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeRun {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,
    pub result: CodeRunResult,
    pub spill_error: bool,
}
impl CodeRun {
    pub fn output_cell_value(&self, x: u32, y: u32) -> Option<CellValue> {
        match &self.result {
            CodeRunResult::Ok { output_value, .. } => match output_value {
                Value::Single(v) => Some(v.clone()),
                Value::Array(a) => Some(a.get(x, y).ok()?.clone()),
            },
            CodeRunResult::Err { .. } => None,
        }
    }

    /// Returns the size of the output array, or defaults to `_1X1` (since output always includes the code_cell).
    /// Note: this does not take spill_error into account.
    pub fn output_size(&self) -> ArraySize {
        match &self.result {
            CodeRunResult::Ok { output_value, .. } => match output_value {
                Value::Single(_) => ArraySize::_1X1,
                Value::Array(a) => a.size(),
            },
            CodeRunResult::Err { .. } => ArraySize::_1X1,
        }
    }

    pub fn is_html(&self) -> bool {
        if let Some(code_cell_value) = self.output_cell_value(0, 0) {
            code_cell_value.is_html()
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
    pub fn output_rect(&self, pos: Pos) -> Rect {
        if self.spill_error {
            Rect::from_pos_and_size(pos, ArraySize::_1X1)
        } else {
            Rect::from_pos_and_size(pos, self.output_size())
        }
    }

    /// Returns any error in a code run.
    pub fn get_error(&self) -> Option<Error> {
        match &self.result {
            CodeRunResult::Ok { .. } => None,
            CodeRunResult::Err { error } => Some(error.clone()),
        }
    }

    pub fn cells_accessed(&self) -> Option<&HashSet<SheetRect>> {
        match &self.result {
            CodeRunResult::Ok { cells_accessed, .. } => Some(cells_accessed),
            CodeRunResult::Err { .. } => None,
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
#[serde(untagged)]
pub enum CodeRunResult {
    Ok {
        output_value: Value,
        cells_accessed: HashSet<SheetRect>,
    },
    Err {
        error: Error,
    },
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{grid::SheetId, Array};

    #[test]
    fn test_output_size() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            result: CodeRunResult::Ok {
                cells_accessed: HashSet::new(),
                output_value: Value::Single(CellValue::Number(1.into())),
            },
            spill_error: false,
        };
        assert_eq!(code_run.output_size(), code_run::ArraySize::_1X1);
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
            result: CodeRunResult::Ok {
                output_value: crate::Value::Array(Array::new_empty(
                    ArraySize::new(10, 11).unwrap(),
                )),
                cells_accessed: HashSet::new(),
            },
            spill_error: false,
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
    fn test_output_sheet_rect_spill_error() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
            formatted_code_string: None,
            std_out: None,
            std_err: None,
            result: CodeRunResult::Ok {
                output_value: crate::Value::Array(Array::new_empty(
                    ArraySize::new(10, 11).unwrap(),
                )),
                cells_accessed: HashSet::new(),
            },
            spill_error: true,
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
