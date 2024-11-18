use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::grid::file::v1_7_1;

use super::CellRefRangeSchema;

pub type CellsAccessedSchema = Vec<(v1_7_1::IdSchema, Vec<CellRefRangeSchema>)>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodeRunSchema {
    pub formatted_code_string: Option<String>,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
    pub cells_accessed: CellsAccessedSchema,
    pub result: v1_7_1::CodeRunResultSchema,
    pub return_type: Option<String>,
    pub line_number: Option<u32>,
    pub output_type: Option<String>,
    pub spill_error: bool,
    pub last_modified: Option<DateTime<Utc>>,
}
