use crate::{
    CellValue, Pos, SheetPos, TablePos,
    grid::{CodeCellValue, Sheet},
};

impl Sheet {
    /// Converts a table_pos to a sheet_pos
    pub fn table_pos_to_sheet_pos(&self, table_pos: TablePos) -> Option<SheetPos> {
        let table_sheet_pos = table_pos.table_sheet_pos;
        let table = self.data_table_at(&table_sheet_pos.into())?;

        let pos = table_pos.pos;

        let Ok(x_u32) = u32::try_from(pos.x) else {
            return None;
        };

        if table.is_column_hidden(x_u32 as usize) {
            return None;
        }

        let x = table.get_display_index_from_column_index(x_u32, false);

        let reverse_display_buffer = table.get_reverse_display_buffer();
        let y = table.get_display_index_from_reverse_display_buffer(
            u64::try_from(pos.y).ok()?,
            reverse_display_buffer.as_ref(),
        ) as i64
            + table.y_adjustment(true);

        Some(SheetPos {
            x: table_sheet_pos.x + x,
            y: table_sheet_pos.y + y,
            sheet_id: table_sheet_pos.sheet_id,
        })
    }

    /// Converts a display_pos to a table_pos
    pub fn display_pos_to_table_pos(&self, display_pos: Pos) -> Option<TablePos> {
        let (data_table_pos, data_table) = self.data_table_that_contains(display_pos)?;

        // if anchor, then return a SheetPos and not a TablePos
        if data_table.is_code() || data_table_pos == display_pos {
            return None;
        }

        let table_col = data_table.get_column_index_from_display_index(
            u32::try_from(display_pos.x - data_table_pos.x).ok()?,
            true,
        );

        let table_row = data_table.get_row_index_from_display_index(
            u64::try_from(display_pos.y - data_table_pos.y - data_table.y_adjustment(true)).ok()?,
        );

        Some(TablePos::new(
            data_table_pos.to_sheet_pos(self.id),
            Pos::new(table_col as i64, table_row as i64),
        ))
    }

    /// Returns the code cell value at the table pos.
    pub fn table_pos_code_value(&self, table_pos: TablePos) -> Option<&CodeCellValue> {
        let table_sheet_pos = table_pos.table_sheet_pos;
        let table = self.data_table_at(&table_sheet_pos.into())?;
        table
            .absolute_value_ref_at(table_pos.pos)
            .and_then(|cell_value| match cell_value {
                CellValue::Code(code_cell) => Some(code_cell),
                _ => None,
            })
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
            Some(pos![sheet_id!A3])
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
            false,
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
