//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.data_tables. CodeRun is optional within sheet.data_tables for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::{RunError, SheetRect};
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
    pub error: Option<RunError>,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
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
mod test {
    // use super::*;
    // use crate::{grid::SheetId, Array};
    // use serial_test::parallel;
}
