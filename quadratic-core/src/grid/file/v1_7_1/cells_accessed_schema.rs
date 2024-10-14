use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::grid::file::v1_7_1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RelRectSchema {
    pub min: RelPosSchema,
    pub max: RelPosSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RelPosSchema {
    pub x: RelColRowSchema,
    pub y: RelColRowSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RelColRowSchema {
    pub index: u64,
    pub relative: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RelColRowRangeSchema {
    pub min: RelColRowSchema,
    pub max: RelColRowSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum A1RangeTypeSchema {
    All,
    Column(RelColRowSchema),
    Row(RelColRowSchema),
    ColumnRange(RelColRowRangeSchema),
    RowRange(RelColRowRangeSchema),
    Rect(RelRectSchema),
    Pos(RelPosSchema),
}

pub type CellsAccessedSchema = Vec<(v1_7_1::IdSchema, Vec<A1RangeTypeSchema>)>;

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
