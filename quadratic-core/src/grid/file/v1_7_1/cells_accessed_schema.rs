use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::grid::file::v1_7_1;

use super::CellRefRangeSchema;

pub(crate) type CellsAccessedSchema = Vec<(v1_7_1::IdSchema, Vec<CellRefRangeSchema>)>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CodeRunSchema {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) formatted_code_string: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) std_out: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) std_err: Option<String>,

    pub(crate) cells_accessed: CellsAccessedSchema,

    pub(crate) result: v1_7_1::CodeRunResultSchema,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) return_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) line_number: Option<u32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) output_type: Option<String>,

    pub(crate) spill_error: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_modified: Option<DateTime<Utc>>,
}
