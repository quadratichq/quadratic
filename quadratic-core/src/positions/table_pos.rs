//! Used for referencing a pos in a data table.

use crate::{Pos, SheetPos, grid::SheetId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Hash, Copy, Clone)]
pub struct TablePos {
    pub table_sheet_pos: SheetPos,
    pub pos: Pos,
}

impl TablePos {
    pub fn new(table_sheet_pos: SheetPos, code_pos: Pos) -> Self {
        Self {
            table_sheet_pos,
            pos: code_pos,
        }
    }

    pub fn sheet_id(&self) -> SheetId {
        self.table_sheet_pos.sheet_id
    }

    pub fn set_sheet_id(&mut self, sheet_id: SheetId) {
        self.table_sheet_pos.sheet_id = sheet_id;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_pos() {
        let sheet_id = SheetId::TEST;
        let table_pos = pos![sheet_id!A1];
        let code_pos = Pos { x: 0, y: 0 };
        let table_pos = TablePos::new(table_pos, code_pos);

        assert_eq!(table_pos.table_sheet_pos, pos![sheet_id!A1]);
        assert_eq!(table_pos.pos, Pos { x: 0, y: 0 });
    }
}
