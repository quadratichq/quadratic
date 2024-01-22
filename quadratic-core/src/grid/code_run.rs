//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.code_runs. CodeRun is optional within sheet.code_runs for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::{ArraySize, CellValue, Pos, Rect, RunError, SheetPos, SheetRect, Value};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use strum_macros::{Display, EnumString};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeRun {
    pub formatted_code_string: Option<String>,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: HashSet<SheetRect>,
    pub result: CodeRunResult,
    pub spill_error: bool,
    pub last_modified: DateTime<Utc>,
}

impl CodeRun {
    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns CellValue::Blank. Note: this assumes a CellValue::Code exists at the location.
    pub fn cell_value_at(&self, x: u32, y: u32) -> Option<CellValue> {
        if self.spill_error {
            Some(CellValue::Blank)
        } else {
            match &self.result {
                CodeRunResult::Ok(value) => match value {
                    Value::Single(v) => Some(v.clone()),
                    Value::Array(a) => Some(a.get(x, y).ok()?.clone()),
                },
                CodeRunResult::Err(_) => None,
            }
        }
    }

    /// Returns the size of the output array, or defaults to `_1X1` (since output always includes the code_cell).
    /// Note: this does not take spill_error into account.
    pub fn output_size(&self) -> ArraySize {
        match &self.result {
            CodeRunResult::Ok(value) => match value {
                Value::Single(_) => ArraySize::_1X1,
                Value::Array(a) => a.size(),
            },
            CodeRunResult::Err(_) => ArraySize::_1X1,
        }
    }

    pub fn is_html(&self) -> bool {
        if let Some(code_cell_value) = self.cell_value_at(0, 0) {
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

#[derive(Serialize, Deserialize, Display, Debug, Copy, Clone, PartialEq, Eq, Hash, EnumString)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    Python,
    Formula,
    // JavaScript,
    // Sql,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum CodeRunResult {
    Ok(Value),
    Err(RunError),
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
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(Value::Single(CellValue::Number(1.into()))),
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
