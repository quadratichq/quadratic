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
    /// Creates a new SheetPos.
    pub fn new_sheet_pos(sheet_id: SheetId, pos: Pos) -> Self {
        MultiPos::SheetPos(pos.to_sheet_pos(sheet_id))
    }

    /// Creates a new TablePos.
    pub fn new_table_pos(sheet_id: SheetId, parent_pos: &Pos, sub_table_pos: Pos) -> Self {
        MultiPos::TablePos(TablePos::new(
            parent_pos.to_sheet_pos(sheet_id),
            sub_table_pos,
        ))
    }

    /// Returns the sheet_id of the MultiPos.
    pub fn sheet_id(&self) -> SheetId {
        match self {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.sheet_id,
            MultiPos::TablePos(table_pos) => table_pos.sheet_id(),
        }
    }

    /// Returns true if the MultiPos is a TablePos.
    pub fn is_table_pos(&self) -> bool {
        matches!(self, MultiPos::TablePos(_))
    }

    /// Properly converts a MultiPos to a SheetPos. (For TablePos, this is
    /// relative to the current state of the sheet.)
    pub fn to_sheet_pos(&self, sheet: &Sheet) -> Option<SheetPos> {
        match self {
            MultiPos::SheetPos(sheet_pos) => Some(*sheet_pos),
            MultiPos::TablePos(table_pos) => sheet.table_pos_to_sheet_pos(*table_pos),
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
            MultiPos::TablePos(table_pos) => {
                sheet.table_pos_to_sheet_pos(*table_pos).map(Into::into)
            }
        }
    }

    /// Translates the pos in place by the given delta, clamping the result to the given min.
    pub fn translate_in_place(&mut self, x: i64, y: i64, min_x: i64, min_y: i64) {
        match self {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.translate_in_place(x, y, min_x, min_y),
            MultiPos::TablePos(table_pos) => table_pos.pos.translate_in_place(x, y, min_x, min_y),
        }
    }

    /// Returns a new Pos translated by the given delta, clamping the result to the given min.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn translate(&self, x: i64, y: i64, min_x: i64, min_y: i64) -> Self {
        let mut pos = *self;
        pos.translate_in_place(x, y, min_x, min_y);
        pos
    }

    #[cfg(test)]
    pub fn to_pos(self) -> Pos {
        self.into()
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

#[cfg(test)]
impl From<MultiPos> for Pos {
    fn from(multi_pos: MultiPos) -> Self {
        match multi_pos {
            MultiPos::SheetPos(sheet_pos) => sheet_pos.into(),
            MultiPos::TablePos(_) => panic!("TablePos cannot be converted to Pos"),
        }
    }
}

#[cfg(test)]
impl From<MultiPos> for SheetRect {
    fn from(multi_pos: MultiPos) -> Self {
        match multi_pos {
            MultiPos::SheetPos(sheet_pos) => SheetRect {
                min: sheet_pos.into(),
                max: sheet_pos.into(),
                sheet_id: sheet_pos.sheet_id,
            },
            MultiPos::TablePos(_) => panic!("TablePos cannot be converted to SheetRect"),
        }
    }
}
