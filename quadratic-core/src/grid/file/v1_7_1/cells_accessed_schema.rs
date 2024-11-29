use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::grid::file::v1_7_1;

use super::CellRefRangeSchema;

pub type CellsAccessedSchema = Vec<(v1_7_1::IdSchema, Vec<CellRefRangeSchema>)>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_code_string: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_out: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub std_err: Option<String>,

    pub cells_accessed: CellsAccessedSchema,

    pub result: v1_7_1::CodeRunResultSchema,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_number: Option<u32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_type: Option<String>,

    pub spill_error: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<DateTime<Utc>>,
}
