use crate::{SheetPos, TablePos, grid::SheetId};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum MultiPos {
    SheetPos(SheetPos),
    TablePos(TablePos),
}

impl MultiPos {
    pub fn sheet_id(&self) -> SheetId {
        match self {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.sheet_id,
            MultiPos::TablePos(table_pos) => table_pos.sheet_id(),
        }
    }
}

impl From<SheetPos> for MultiPos {
    fn from(sheet_pos: SheetPos) -> Self {
        MultiPos::SheetPos(sheet_pos)
    }
}

impl From<TablePos> for MultiPos {
    fn from(table_pos: TablePos) -> Self {
        MultiPos::TablePos(table_pos)
    }
}
