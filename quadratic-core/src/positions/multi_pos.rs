use crate::{
    MultiSheetPos, Pos, SheetPos, TablePos,
    grid::{Sheet, SheetId},
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum MultiPos {
    Pos(Pos),
    TablePos(TablePos),
}

impl MultiPos {
    /// Creates a new SheetPos.
    pub fn new_pos(pos: Pos) -> Self {
        MultiPos::Pos(pos)
    }

    /// Creates a new TablePos.
    pub fn new_table_pos(parent_pos: Pos, sub_table_pos: Pos) -> Self {
        MultiPos::TablePos(TablePos::new(parent_pos, sub_table_pos))
    }

    /// Returns true if the MultiPos is a TablePos.
    pub fn is_table_pos(&self) -> bool {
        matches!(self, MultiPos::TablePos(_))
    }

    /// Properly converts a MultiPos to a SheetPos. (For TablePos, this is
    /// relative to the current state of the sheet.)
    pub fn to_sheet_pos(&self, sheet: &Sheet) -> Option<SheetPos> {
        match self {
            MultiPos::Pos(pos) => Some((*pos, sheet.id).into()),
            MultiPos::TablePos(table_pos) => sheet.table_pos_to_sheet_pos(*table_pos),
        }
    }

    /// Converts a MultiPos to a MultiSheetPos.
    pub fn to_multi_sheet_pos(&self, sheet_id: SheetId) -> MultiSheetPos {
        MultiSheetPos::new(sheet_id, *self)
    }

    /// Returns the translated_pos of the MultiPos. A translated_pos is the x,y
    /// coordinate mapped for a TablePos (and just the x, y for a SheetPos).
    pub fn translate_pos(&self, sheet: &Sheet) -> Option<Pos> {
        match self {
            MultiPos::Pos(pos) => Some(*pos),
            MultiPos::TablePos(table_pos) => {
                sheet.table_pos_to_sheet_pos(*table_pos).map(Into::into)
            }
        }
    }

    /// Translates the pos in place by the given delta, clamping the result to the given min.
    pub fn translate_in_place(&mut self, x: i64, y: i64, min_x: i64, min_y: i64) {
        match self {
            MultiPos::Pos(pos) => pos.translate_in_place(x, y, min_x, min_y),
            MultiPos::TablePos(table_pos) => table_pos
                .sub_table_pos
                .translate_in_place(x, y, min_x, min_y),
        }
    }

    /// Returns a new Pos translated by the given delta, clamping the result to the given min.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn translate(&self, x: i64, y: i64, min_x: i64, min_y: i64) -> Self {
        let mut pos = *self;
        pos.translate_in_place(x, y, min_x, min_y);
        pos
    }
}

impl From<Pos> for MultiPos {
    fn from(pos: Pos) -> Self {
        MultiPos::Pos(pos)
    }
}

impl From<&Pos> for MultiPos {
    fn from(pos: &Pos) -> Self {
        MultiPos::Pos(*pos)
    }
}

impl From<SheetPos> for MultiPos {
    fn from(sheet_pos: SheetPos) -> Self {
        MultiPos::Pos(sheet_pos.into())
    }
}

impl From<TablePos> for MultiPos {
    fn from(table_pos: TablePos) -> Self {
        MultiPos::TablePos(table_pos)
    }
}
