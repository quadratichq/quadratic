use crate::{
    CellValue, SheetPos, TablePos,
    grid::{CodeCellValue, Sheet},
};

impl Sheet {
    /// Converts a table_pos to a sheet_pos
    pub fn table_pos_to_sheet_pos(&self, table_pos: TablePos) -> Option<SheetPos> {
        let table_sheet_pos = table_pos.table_sheet_pos;
        let table = self.data_table_at(&table_sheet_pos.into())?;
        let pos = table_pos.pos;
        let x = table.get_display_index_from_column_index(pos.x as u32, false);
        let y = table.get_display_index_from_row_index(pos.y as u64);
        Some(SheetPos {
            x: table_sheet_pos.x + x,
            y: table_sheet_pos.y + y as i64,
            sheet_id: table_sheet_pos.sheet_id,
        })
    }

    /// Returns the code cell value at the table pos.
    pub fn table_pos_code_value(&self, table_pos: TablePos) -> Option<&CodeCellValue> {
        let table_sheet_pos = table_pos.table_sheet_pos;
        let table = self.data_table_at(&table_sheet_pos.into())?;
        let pos = table_pos.pos;
        let x = table.get_display_index_from_column_index(pos.x as u32, false);
        let y =
            table.get_display_index_from_row_index(pos.y as u64) + table.y_adjustment(true) as u64;
        let cell_value = table.cell_value_ref_at(x as u32, y as u32)?;
        if let CellValue::Code(code_cell) = cell_value {
            Some(code_cell)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        Pos, TablePos,
        grid::{CodeCellLanguage, CodeCellValue},
        test_util::*,
    };

    #[test]
    fn test_table_pos_to_sheet_pos() {
        let (mut gc, sheet_id) = test_grid();

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        let sheet = gc.sheet(sheet_id);
        let table_pos = TablePos::new(pos![sheet_id!A1], Pos::new(0, 0));
        assert_eq!(
            sheet.table_pos_to_sheet_pos(table_pos),
            Some(pos![sheet_id!A1])
        );
    }

    #[test]
    fn test_table_pos_code_value() {
        let (mut gc, sheet_id) = test_grid();

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        gc.set_code_cell(
            pos![sheet_id!A3],
            CodeCellLanguage::Formula,
            "1 + 1".to_string(),
            None,
            None,
        );

        let table_pos = TablePos::new(pos![sheet_id!A1], Pos::new(0, 0));

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.table_pos_code_value(table_pos),
            Some(&CodeCellValue::new(
                CodeCellLanguage::Formula,
                "1 + 1".to_string()
            ))
        );
    }
}
