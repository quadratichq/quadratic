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
    Table(TableRefSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RefRangeBoundsSchema {
    pub start: CellRefRangeEndSchema,
    pub end: CellRefRangeEndSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefRangeEndSchema {
    pub col: CellRefCoordSchema,
    pub row: CellRefCoordSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CellRefCoordSchema {
    pub coord: i64,
    pub is_absolute: bool,
}

impl CellRefCoordSchema {
    pub const UNBOUNDED: Self = CellRefCoordSchema {
        coord: i64::MAX,
        is_absolute: false,
    };
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ColRangeSchema {
    All,
    Col(String),
    ColRange(String, String),
    ColumnToEnd(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TableRefSchema {
    pub table_name: String,
    pub data: bool,
    pub headers: bool,
    pub totals: bool,
    pub col_range: ColRangeSchema,

    #[serde(default)]
    pub this_row: bool,
}
