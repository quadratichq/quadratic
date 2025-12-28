//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.data_tables. CodeRun is optional within sheet.data_tables for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::{RunError, grid::CellsAccessed};
use serde::{Deserialize, Serialize};

mod adjust;

pub use adjust::*;
pub use quadratic_core_shared::{CodeCellLanguage, ConnectionKind};

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
    /// Constructs a code cell.
    pub fn new(language: CodeCellLanguage, code: String) -> Self {
        Self {
            language,
            code,
            ..Default::default()
        }
    }

    /// Constructs a new Python code cell.
    #[cfg(test)]
    pub fn new_python(code: String) -> Self {
        Self {
            language: CodeCellLanguage::Python,
            code,
            ..Default::default()
        }
    }

    pub fn new_formula(code: String) -> Self {
        Self {
            language: CodeCellLanguage::Formula,
            code,
            ..Default::default()
        }
    }

    #[cfg(test)]
    pub fn new_javascript(code: String) -> Self {
        Self {
            language: CodeCellLanguage::Javascript,
            code,
            ..Default::default()
        }
    }

    #[cfg(test)]
    pub fn new_connection(code: String) -> Self {
        Self {
            language: CodeCellLanguage::Connection {
                kind: ConnectionKind::Postgres,
                id: "123".to_string(),
            },
            code,
            ..Default::default()
        }
    }

    /// Returns any error in a code run.
    pub fn get_error(&self) -> Option<RunError> {
        self.error.clone()
    }
}
