use serde::{Deserialize, Serialize};

use super::ids::{CellRef, ColumnId, RowId};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[must_use]
pub struct SetCellResponse<V> {
    pub column: GetIdResponse<ColumnId>,
    pub row: GetIdResponse<RowId>,
    pub old_value: V,

    pub spill: Option<CellRef>,
    pub unspill: Option<CellRef>,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[must_use]
pub struct GetIdResponse<I> {
    pub id: I,
    pub is_new: bool,
}
impl<I> GetIdResponse<I> {
    pub fn new(id: I) -> Self {
        Self { id, is_new: true }
    }
    pub fn old(id: I) -> Self {
        Self { id, is_new: false }
    }
}
