//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.data_tables. CodeRun is optional within sheet.data_tables for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::RunError;
use serde::{Deserialize, Serialize};
use strum_macros::Display;
use wasm_bindgen::{JsValue, convert::IntoWasmAbi};

use super::cells_accessed::CellsAccessed;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct CodeRun {
    pub language: CodeCellLanguage,

    pub code: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,

    pub cells_accessed: CellsAccessed,

    #[serde(skip_serializing_if = "Option::is_none")]
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

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CodeCellLanguage {
    #[default]
    Python,
    Formula,
    /// Database connection.
    Connection {
        kind: ConnectionKind,
        id: String,
    },
    Javascript,
    /// CSV or other file import.
    Import,
}

impl CodeCellLanguage {
    pub fn is_code_language(&self) -> bool {
        matches!(
            self,
            CodeCellLanguage::Python | CodeCellLanguage::Javascript
        )
    }

    /// Returns whether this language that uses `q.cells()` syntax (either
    /// Python or Javascript).
    pub fn has_q_cells(&self) -> bool {
        *self == CodeCellLanguage::Python || *self == CodeCellLanguage::Javascript
    }

    pub fn has_handle_bars(&self) -> bool {
        matches!(self, CodeCellLanguage::Connection { .. })
    }
}

#[derive(Serialize, Deserialize, Display, Copy, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "UPPERCASE")]
pub enum ConnectionKind {
    Postgres,
    Mysql,
    Mssql,
    Snowflake,
    Cockroachdb,
    Bigquery,
    Mariadb,
    Supabase,
    Neon,
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
