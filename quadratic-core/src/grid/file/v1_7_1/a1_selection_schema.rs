use serde::{Deserialize, Serialize};

use crate::grid::file::v1_7_1;

use super::PosSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct A1SelectionSchema {
    pub(crate) sheet_id: v1_7_1::IdSchema,
    pub(crate) cursor: PosSchema,
    pub(crate) ranges: Vec<CellRefRangeSchema>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum CellRefRangeSchema {
    Sheet(RefRangeBoundsSchema),
    Table(TableRefSchema),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct RefRangeBoundsSchema {
    pub(crate) start: CellRefRangeEndSchema,
    pub(crate) end: CellRefRangeEndSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CellRefRangeEndSchema {
    pub(crate) col: CellRefCoordSchema,
    pub(crate) row: CellRefCoordSchema,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct CellRefCoordSchema {
    pub(crate) coord: i64,
    pub(crate) is_absolute: bool,
}

impl CellRefCoordSchema {
    pub(crate) const UNBOUNDED: Self = CellRefCoordSchema {
        coord: i64::MAX,
        is_absolute: false,
    };
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) enum ColRangeSchema {
    All,
    Col(String),
    ColRange(String, String),
    ColumnToEnd(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub(crate) struct TableRefSchema {
    pub(crate) table_name: String,
    pub(crate) data: bool,
    pub(crate) headers: bool,
    pub(crate) totals: bool,
    pub(crate) col_range: ColRangeSchema,
}
