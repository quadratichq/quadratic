use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{ArraySize, CellValue, Error, Rect, SheetPos, Value};

/// Code and language of a code cell
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCell {
    pub language: CodeCellLanguage,
    pub code_string: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,

    // TODO(ddimaria): This should be a timestamp
    pub last_modified: String,
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

/// The result of running a code cell
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeCellRun {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,
    pub result: CodeCellRunResult,
    pub spill_error: bool,

    // stored in Unix timestamp
    pub last_code_run: u32,
}
impl CodeCellRun {
    /// Returns the value (single cell or array) outputted by the code run if it
    /// succeeded, or `None` if it failed or has never been run.
    pub fn output_value(&self) -> Option<&Value> {
        self.result.output_value()
    }

    pub fn cells_accessed(&self) -> Option<&HashSet<SheetPos>> {
        match &self.result {
            CodeCellRunResult::Ok { cells_accessed, .. } => Some(cells_accessed),
            CodeCellRunResult::Err { .. } => None,
        }
    }

    /// Returns the output at a given (x, y) within the output array
    pub fn get_at(&self, x: u32, y: u32) -> Option<CellValue> {
        match &self.output_value()? {
            Value::Single(v) => Some(v.clone()),
            Value::Array(a) => Some(a.get(x, y).ok()?.clone()),
        }
    }

    /// Returns the size of the output array.
    pub fn output_size(&self) -> Option<ArraySize> {
        match self.output_value() {
            Some(Value::Array(a)) => Some(a.size()),
            Some(Value::Single(_)) => Some(ArraySize::_1X1),
            None => None,
        }
    }

    /// returns a Rect w/0,0 origin for the output of the code cell
    pub fn output_origin_rect(&self) -> Option<Rect> {
        self.output_size()
            .map(|size| Rect::from_pos_and_size((0, 0).into(), size))
    }

    pub fn is_html(&self) -> bool {
        if let Some(code_cell_value) = self.get_at(0, 0) {
            code_cell_value.is_html()
        } else {
            false
        }
    }

    pub fn cells_accessed_copy(&self) -> Option<HashSet<SheetPos>> {
        self.cells_accessed().cloned()
    }

    pub fn get_error(&self) -> Option<Error> {
        let error = &self.result;
        if let CodeCellRunResult::Err { error } = error {
            Some(error.clone())
        } else {
            None
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum CodeCellRunResult {
    Ok {
        output_value: Value,
        cells_accessed: HashSet<SheetPos>,
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
    use crate::{Array, Pos};

    #[test]
    fn test_code_cell_run_output() {
        let run = CodeCellRun {
            std_out: None,
            std_err: None,
            result: CodeCellRunResult::Ok {
                output_value: crate::Value::Array(Array::new_empty(
                    ArraySize::new(10, 11).unwrap(),
                )),
                cells_accessed: HashSet::new(),
            },
            spill_error: false,
            last_code_run: 0,
        };
        assert_eq!(run.output_size(), None);
        assert_eq!(run.output_origin_rect(), None);

        let run = CodeCellRun {
            std_out: None,
            std_err: None,
            result: super::CodeCellRunResult::Ok {
                output_value: crate::Value::Array(Array::new_empty(
                    ArraySize::new(10, 11).unwrap(),
                )),
                cells_accessed: HashSet::new(),
            },
            spill_error: false,
            last_code_run: 0,
        };
        assert_eq!(run.output_size().unwrap().w.get(), 10);
        assert_eq!(run.output_size().unwrap().h.get(), 11);
        assert_eq!(
            run.output_origin_rect(),
            Some(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 9, y: 10 }))
        );
    }
}
