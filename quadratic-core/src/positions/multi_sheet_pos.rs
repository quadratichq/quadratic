#[cfg(test)]
use crate::SheetRect;
use crate::{
    MultiPos, SheetPos,
    grid::{Sheet, SheetId},
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct MultiSheetPos {
    pub sheet_id: SheetId,
    pub multi_pos: MultiPos,
}

impl MultiSheetPos {
    pub fn new(sheet_id: SheetId, multi_pos: MultiPos) -> Self {
        Self {
            sheet_id,
            multi_pos,
        }
    }

    /// Returns true if the MultiSheetPos is a TablePos.
    pub fn is_table_pos(&self) -> bool {
        self.multi_pos.is_table_pos()
    }

    pub fn to_sheet_pos(&self, sheet: &Sheet) -> Option<SheetPos> {
        match self.multi_pos {
            MultiPos::Pos(pos) => Some((pos, self.sheet_id).into()),
            MultiPos::TablePos(table_pos) => sheet.table_pos_to_sheet_pos(table_pos),
        }
    }
}

impl From<SheetPos> for MultiSheetPos {
    fn from(sheet_pos: SheetPos) -> Self {
        MultiSheetPos::new(sheet_pos.sheet_id, sheet_pos.into())
    }
}

#[cfg(test)]
impl From<MultiSheetPos> for SheetRect {
    fn from(multi_sheet_pos: MultiSheetPos) -> Self {
        match multi_sheet_pos.multi_pos {
            MultiPos::Pos(pos) => SheetRect {
                min: pos,
                max: pos,
                sheet_id: multi_sheet_pos.sheet_id,
            },
            MultiPos::TablePos(_) => panic!("TablePos cannot be converted to SheetRect"),
        }
    }
}
