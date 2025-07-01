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

    /// Used by tests as a shortcut to get a sheet pos from a table pos without checking
    /// the sheet.
    #[cfg(test)]
    pub fn to_absolute_sheet_pos(&self) -> SheetPos {
        SheetPos {
            x: self.table_sheet_pos.x + self.pos.x,
            y: self.table_sheet_pos.y + self.pos.y,
            sheet_id: self.table_sheet_pos.sheet_id,
        }
    }

    // /// Returns the cell value ref at the table pos.
    // pub fn cell_value<'a>(&self, sheet: &'a Sheet) -> Option<&'a CellValue> {
    //     let table = sheet.data_table_at(&self.table_sheet_pos.into())?;
    //     table.cell_value_ref_at(self.pos.x as u32, self.pos.y as u32)
    // }

    // /// Returns the code cell at the table pos.
    // pub fn code_cell<'a>(&self, sheet: &'a Sheet) -> Option<&'a CodeCellValue> {
    //     let cell_value = self.cell_value(sheet)?;
    //     if let CellValue::Code(code_cell) = cell_value {
    //         Some(code_cell)
    //     } else {
    //         None
    //     }
    // }

    // /// Returns the translated Pos of the code cell in the table relative to the sheet.
    // pub fn translate_pos(&self, sheet: &Sheet) -> Option<Pos> {
    //     let table = sheet.data_table_at(&self.table_sheet_pos.into())?;
    //     let x = table.get_display_index_from_column_index(self.pos.x as u32, false);
    //     let y = table.get_display_index_from_row_index(self.pos.y as u64);
    //     Some(Pos { x, y: y as i64 })
    // }

    // /// Returns the code cell at the table pos.
    // pub fn code_cell_from_gc<'a>(&self, gc: &'a GridController) -> Option<&'a CodeCellValue> {
    //     let sheet = gc.try_sheet(self.table_sheet_pos.sheet_id)?;
    //     self.code_cell(sheet)
    // }

    // /// Returns a code table within a table on the sheet.
    // pub fn data_table<'a>(&self, sheet: &'a Sheet) -> Option<&'a DataTable> {
    //     let table = sheet.data_table_at(&self.table_sheet_pos.into())?;
    //     table
    //         .tables
    //         .as_ref()
    //         .and_then(|tables| tables.get_at(&self.pos))
    // }

    pub fn sheet_id(&self) -> SheetId {
        self.table_sheet_pos.sheet_id
    }

    pub fn set_sheet_id(&mut self, sheet_id: SheetId) {
        self.table_sheet_pos.sheet_id = sheet_id;
    }
}

/// This should not be used in production code, since TablePos -> Pos cannot be
/// determined without Sheet information (but this is fine in most tests).
#[cfg(test)]
impl From<TablePos> for Pos {
    fn from(table_pos: TablePos) -> Self {
        Pos {
            x: table_pos.pos.x + table_pos.table_sheet_pos.x,
            y: table_pos.pos.y + table_pos.table_sheet_pos.y,
        }
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
