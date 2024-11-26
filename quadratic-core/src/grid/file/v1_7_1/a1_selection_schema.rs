use serde::{Deserialize, Serialize};

use crate::grid::file::v1_7_1;

use super::PosSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct A1SelectionSchema {
    pub sheet_id: v1_7_1::IdSchema,
    pub cursor: PosSchema,
    pub ranges: Vec<CellRefRangeSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellRefRangeSchema {
    Sheet(RefRangeBoundsSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RefRangeBoundsSchema {
    pub start: CellRefRangeEndSchema,
    pub end: Option<CellRefRangeEndSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefRangeEndSchema {
    pub col: Option<CellRefCoordSchema>,
    pub row: Option<CellRefCoordSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefCoordSchema {
    pub coord: u64,
    pub is_absolute: bool,
}
