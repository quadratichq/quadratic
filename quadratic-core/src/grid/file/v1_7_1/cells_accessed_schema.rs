use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{grid::file::v1_7_1, Pos};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefRangeSchema {
    pub start: CellRefRangeEndSchema,
    pub end: Option<CellRefRangeEndSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefRangeEndSchema {
    pub col: Option<CellRefCoordSchema>,
    pub row: Option<CellRefCoordSchema>,
}
impl CellRefRangeEndSchema {
    pub fn new_relative_pos(x: i64, y: i64) -> Self {
        Self {
            col: Some(CellRefCoordSchema {
                coord: x as u64,
                is_absolute: false,
            }),
            row: Some(CellRefCoordSchema {
                coord: y as u64,
                is_absolute: false,
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefCoordSchema {
    pub coord: u64,
    pub is_absolute: bool,
}

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
