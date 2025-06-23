use crate::Pos;
#[cfg(test)]
use crate::SheetRect;
use crate::{
    SheetPos, TablePos,
    grid::{Sheet, SheetId},
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum MultiPos {
    SheetPos(SheetPos),
    TablePos(TablePos),
}

impl MultiPos {
    pub fn new_sheet_pos(sheet_id: SheetId, x: i64, y: i64) -> Self {
        MultiPos::SheetPos(SheetPos { sheet_id, x, y })
    }

    pub fn sheet_id(&self) -> SheetId {
        match self {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.sheet_id,
            MultiPos::TablePos(table_pos) => table_pos.sheet_id(),
        }
    }

    /// Properly converts a MultiPos to a SheetPos. (For TablePos, this is
    /// relative to the current state of the sheet.)
    pub fn to_sheet_pos(&self, sheet: &Sheet) -> Option<SheetPos> {
        match self {
            MultiPos::SheetPos(sheet_pos) => Some(*sheet_pos),
            MultiPos::TablePos(table_pos) => table_pos.to_sheet_pos(sheet),
        }
    }

    pub fn set_sheet_id(&mut self, sheet_id: SheetId) {
        match self {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.sheet_id = sheet_id,
            MultiPos::TablePos(table_pos) => table_pos.set_sheet_id(sheet_id),
        }
    }

    /// Returns the translated_pos of the MultiPos. A translated_pos is the x,y
    /// coordinate mapped for a TablePos (and just the x, y for a SheetPos).
    pub fn translate_pos(&self, sheet: &Sheet) -> Option<Pos> {
        match self {
            MultiPos::SheetPos(sheet_pos) => Some((*sheet_pos).into()),
            MultiPos::TablePos(table_pos) => table_pos.translate_pos(sheet),
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
