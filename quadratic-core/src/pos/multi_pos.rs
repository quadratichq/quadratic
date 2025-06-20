#[cfg(test)]
use crate::{Pos, SheetRect};
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

/// This should not be used in production code, since TablePos -> Pos cannot be
/// determined without Sheet information (but this is fine in most tests).
#[cfg(test)]
impl From<MultiPos> for Pos {
    fn from(multi_pos: MultiPos) -> Self {
        match multi_pos {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.into(),
            MultiPos::TablePos(table_pos) => Pos::from(table_pos),
        }
    }
}

/// This should not be used in production code, since TablePos -> Pos cannot be
/// determined without Sheet information (but this is fine in most tests).
#[cfg(test)]
impl From<MultiPos> for SheetRect {
    fn from(multi_pos: MultiPos) -> Self {
        use crate::SheetRect;

        match multi_pos {
            MultiPos::SheetPos(sheet_pos) => SheetRect {
                min: sheet_pos.into(),
                max: sheet_pos.into(),
                sheet_id: sheet_pos.sheet_id,
            },
            MultiPos::TablePos(table_pos) => SheetRect {
                min: Pos::from(table_pos),
                max: Pos::from(table_pos),
                sheet_id: table_pos.sheet_id(),
            },
        }
    }
}
