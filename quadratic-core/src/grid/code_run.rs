//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.data_tables. CodeRun is optional within sheet.data_tables for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::{RunError, SheetPos, SheetRect, Value};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use strum_macros::Display;
use wasm_bindgen::{convert::IntoWasmAbi, JsValue};

use super::cells_accessed::CellsAccessed;

// This is a deprecated version of CodeRun that is only used for file v1.7 and below.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CodeRunOld {
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: Vec<SheetRect>,
    pub result: CodeRunResult,
    pub return_type: Option<String>,
    pub spill_error: bool,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
    pub last_modified: DateTime<Utc>,
}

impl From<Vec<SheetRect>> for CellsAccessed {
    fn from(old: Vec<SheetRect>) -> Self {
        let mut cells = CellsAccessed::default();
        for rect in old {
            cells.add_sheet_pos(SheetPos::new(rect.sheet_id, rect.min.x, rect.min.y));
        }
        cells
    }
}

impl From<CodeRunOld> for CodeRun {
    fn from(old: CodeRunOld) -> Self {
        let error = match old.result {
            CodeRunResult::Ok(_) => None,
            CodeRunResult::Err(e) => Some(e),
        };
        Self {
            std_out: old.std_out,
            std_err: old.std_err,
            cells_accessed: old.cells_accessed.into(),
            // result: old.result,
            return_type: old.return_type,
            // spill_error: old.spill_error,
            line_number: old.line_number,
            output_type: old.output_type,
            error,
            // last_modified: old.last_modified,
        }
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct CodeRun {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,

    pub cells_accessed: CellsAccessed,
    pub error: Option<RunError>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_number: Option<u32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_type: Option<String>,
}

impl CodeRun {
    /// Returns any error in a code run.
    pub fn get_error(&self) -> Option<RunError> {
        self.error.clone()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    Python,
    Formula,
    Connection { kind: ConnectionKind, id: String },
    Javascript,
    Import,
    AIResearcher,
}

#[derive(Serialize, Deserialize, Display, Copy, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "UPPERCASE")]
pub enum ConnectionKind {
    Postgres,
    Mysql,
    Mssql,
    Snowflake,
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

// /// Custom version of [`std::result::Result`] that serializes the way we want.
// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
// #[serde(untagged)]
// pub enum CodeRunResult {
//     Ok(Value),
//     Err(RunError),
// }
// impl CodeRunResult {
//     /// Converts into a [`std::result::Result`] by value.
//     pub fn into_std(self) -> Result<Value, RunError> {
//         match self {
//             CodeRunResult::Ok(v) => Ok(v),
//             CodeRunResult::Err(e) => Err(e),
//         }
//     }
//     /// Converts into a [`std::result::Result`] by reference.
//     pub fn as_std_ref(&self) -> Result<&Value, &RunError> {
//         match self {
//             CodeRunResult::Ok(v) => Ok(v),
//             CodeRunResult::Err(e) => Err(e),
//         }
//     }
// }

#[cfg(test)]
mod test {}
