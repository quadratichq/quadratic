//! Position translation methods for table positions.
//!
//! These methods convert between display coordinates (what the user sees on the sheet)
//! and logical table coordinates (the actual data position within a table).

use crate::{MultiPos, MultiSheetPos, Pos, SheetPos, TablePos};

use super::Sheet;

impl Sheet {
    /// Converts a TablePos to a SheetPos.
    ///
    /// This accounts for:
    /// - The table's anchor position on the sheet
    /// - The table's header rows (name row, column headers)
    /// - Hidden columns
    /// - Sort order / display buffer
    ///
    /// Returns None if:
    /// - The table doesn't exist at the parent position
    /// - The coordinates are out of bounds
    pub fn table_pos_to_sheet_pos(&self, table_pos: TablePos) -> Option<SheetPos> {
        let parent_pos = table_pos.parent_pos;
        let data_table = self.data_table_at(&parent_pos)?;

        let sub_table_pos = table_pos.sub_table_pos;

        // Check if column index is valid
        let Ok(col_u32) = u32::try_from(sub_table_pos.x) else {
            return None;
        };

        // Get the display column index (accounting for hidden columns)
        let display_x = data_table.get_display_index_from_column_index(col_u32, false);

        // Get the display row index (accounting for sorting)
        let row_u64 = u64::try_from(sub_table_pos.y).ok()?;
        let reverse_display_buffer = data_table.get_reverse_display_buffer();
        let display_y = data_table.get_display_index_from_reverse_display_buffer(
            row_u64,
            reverse_display_buffer.as_ref(),
        ) as i64
            + data_table.y_adjustment(true);

        Some(SheetPos {
            x: parent_pos.x + display_x,
            y: parent_pos.y + display_y,
            sheet_id: self.id,
        })
    }

    /// Converts a display position to a TablePos if the position is within a table.
    ///
    /// Returns None if:
    /// - The position is not within any table
    /// - The position is the table's anchor cell (anchor cells are treated as sheet positions)
    /// - The table is a code table (code tables don't have editable cells)
    pub fn display_pos_to_table_pos(&self, display_pos: Pos) -> Option<TablePos> {
        let (data_table_pos, data_table) = self.data_table_that_contains(display_pos)?;

        // Anchor cell and code tables return a sheet position, not a table position
        if data_table.is_code() || data_table_pos == display_pos {
            return None;
        }

        // Calculate the column index in the table data
        let display_col_offset = u32::try_from(display_pos.x - data_table_pos.x).ok()?;
        let table_col = data_table.get_column_index_from_display_index(display_col_offset, true);

        // Calculate the row index in the table data
        let y_adjustment = data_table.y_adjustment(true);
        let display_row_offset =
            u64::try_from(display_pos.y - data_table_pos.y - y_adjustment).ok()?;
        let table_row = data_table.get_row_index_from_display_index(display_row_offset);

        Some(TablePos::new(
            data_table_pos,
            Pos::new(table_col as i64, table_row as i64),
        ))
    }

    /// Converts a display position to a TablePos for in-table code cell placement.
    ///
    /// Unlike `display_pos_to_table_pos`, this method DOES allow conversion within
    /// code tables, as it's specifically for placing code cells within a table's output area.
    ///
    /// Returns None if:
    /// - The position is not within any code table
    /// - The position is the table's anchor cell
    /// - The parent table is not a code table (use `display_pos_to_table_pos` instead)
    pub fn display_pos_to_in_table_code_pos(&self, display_pos: Pos) -> Option<TablePos> {
        let (data_table_pos, data_table) = self.data_table_that_contains(display_pos)?;

        // Only allow in-table code within code tables, not import tables
        if !data_table.is_code() {
            return None;
        }

        // Anchor cell cannot contain in-table code (it IS the code cell)
        if data_table_pos == display_pos {
            return None;
        }

        // Calculate the column index in the table data
        let display_col_offset = u32::try_from(display_pos.x - data_table_pos.x).ok()?;
        let table_col = data_table.get_column_index_from_display_index(display_col_offset, true);

        // Calculate the row index in the table data
        let y_adjustment = data_table.y_adjustment(true);
        let display_row_offset =
            u64::try_from(display_pos.y - data_table_pos.y - y_adjustment).ok()?;
        let table_row = data_table.get_row_index_from_display_index(display_row_offset);

        Some(TablePos::new(
            data_table_pos,
            Pos::new(table_col as i64, table_row as i64),
        ))
    }

    /// Converts a SheetPos to a MultiSheetPos.
    ///
    /// If the position is within a table (and not the anchor cell), returns a MultiSheetPos
    /// with a TablePos. Otherwise returns a MultiSheetPos with a regular Pos.
    pub fn convert_to_multi_sheet_pos(&self, sheet_pos: SheetPos) -> MultiSheetPos {
        let pos: Pos = sheet_pos.into();

        if let Some(table_pos) = self.display_pos_to_table_pos(pos) {
            MultiSheetPos::from_table_pos(self.id, table_pos)
        } else {
            MultiSheetPos::from_pos(self.id, pos)
        }
    }

    /// Converts a MultiSheetPos to a SheetPos.
    ///
    /// For regular Pos, this is a direct conversion.
    /// For TablePos, this translates the table-relative position to sheet coordinates.
    ///
    /// Returns None for TablePos if the translation fails (e.g., hidden column, invalid table).
    pub fn multi_sheet_pos_to_sheet_pos(&self, multi_sheet_pos: MultiSheetPos) -> Option<SheetPos> {
        match multi_sheet_pos.multi_pos {
            MultiPos::Pos(pos) => Some(SheetPos::new(multi_sheet_pos.sheet_id, pos.x, pos.y)),
            MultiPos::TablePos(table_pos) => self.table_pos_to_sheet_pos(table_pos),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        Array, CellValue, Value,
        cellvalue::Import,
        grid::data_table::{DataTable, DataTableKind},
    };
    use chrono::Utc;

    fn create_test_table(width: usize, height: usize) -> DataTable {
        // Build the array of cell values directly
        let values: Vec<CellValue> = (0..height)
            .flat_map(|r| {
                (0..width).map(move |c| CellValue::Text(format!("R{}C{}", r, c)))
            })
            .collect();

        let size = crate::ArraySize::new(width as u32, height as u32).unwrap();
        let array = Array::new_row_major(size, values.into()).unwrap();

        DataTable {
            kind: DataTableKind::Import(Import::new("test.csv".to_string())),
            name: CellValue::Text("TestTable".to_string()),
            value: Value::Array(array),
            last_modified: Utc::now(),
            header_is_first_row: true,
            column_headers: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            spill_value: false,
            spill_data_table: false,
            spill_merged_cell: false,
            alternating_colors: true,
            formats: None,
            borders: None,
            show_name: Some(true),
            show_columns: Some(true),
            chart_pixel_output: None,
            chart_output: None,
            tables: None,
        }
    }

    #[test]
    fn test_table_pos_to_sheet_pos_basic() {
        let mut sheet = Sheet::test();
        let table_anchor = Pos::new(2, 3);

        // Create a 3x4 table with show_name and show_columns, header_is_first_row = true
        let mut table = create_test_table(3, 4);
        table.apply_first_row_as_header();

        sheet.set_data_table(table_anchor, Some(table));

        // Table layout at (2,3):
        // Row 3: Table name row
        // Row 4: Column headers (from first data row - R0Cx)
        // Row 5-7: Data rows 1-3 (R1Cx, R2Cx, R3Cx)
        //
        // y_adjustment with (show_name=true, show_columns=true, header_is_first_row=true) = 1+1-1 = 1
        // But the data starts at row index 1 in the array (row 0 became headers)

        // TablePos (0,0) refers to the first data row in the array
        // Since header_is_first_row=true, data row 0 is actually array row 1 (R1C0)
        // This displays at: anchor.y + y_adjustment + display_row = 3 + 1 + 0 = 4
        let table_pos = TablePos::new(table_anchor, Pos::new(0, 0));
        let sheet_pos = sheet.table_pos_to_sheet_pos(table_pos);
        assert_eq!(sheet_pos, Some(SheetPos::new(sheet.id, 2, 4)));

        // TablePos (1,1) -> data row 1 (array row 2, R2C1)
        // displays at: 3 + 1 + 1 = 5
        let table_pos = TablePos::new(table_anchor, Pos::new(1, 1));
        let sheet_pos = sheet.table_pos_to_sheet_pos(table_pos);
        assert_eq!(sheet_pos, Some(SheetPos::new(sheet.id, 3, 5)));
    }

    #[test]
    fn test_display_pos_to_table_pos_basic() {
        let mut sheet = Sheet::test();
        let table_anchor = Pos::new(2, 3);

        // Create a 3x4 table
        let mut table = create_test_table(3, 4);
        table.apply_first_row_as_header();

        sheet.set_data_table(table_anchor, Some(table));

        // Anchor position should return None (not a table position)
        assert_eq!(sheet.display_pos_to_table_pos(table_anchor), None);

        // Position in data area should return a TablePos
        // Display (2, 4) is the first data cell (y = anchor.y + y_adjustment = 3 + 1 = 4)
        let display_pos = Pos::new(2, 4);
        let table_pos = sheet.display_pos_to_table_pos(display_pos);
        assert!(table_pos.is_some());
        let table_pos = table_pos.unwrap();
        assert_eq!(table_pos.parent_pos, table_anchor);
        assert_eq!(table_pos.sub_table_pos, Pos::new(0, 0));

        // Display (3, 5) -> TablePos (1, 1)
        let display_pos = Pos::new(3, 5);
        let table_pos = sheet.display_pos_to_table_pos(display_pos);
        assert!(table_pos.is_some());
        let table_pos = table_pos.unwrap();
        assert_eq!(table_pos.parent_pos, table_anchor);
        assert_eq!(table_pos.sub_table_pos, Pos::new(1, 1));
    }

    #[test]
    fn test_convert_to_multi_sheet_pos() {
        let mut sheet = Sheet::test();
        let table_anchor = Pos::new(2, 3);

        // Create a table
        let mut table = create_test_table(3, 4);
        table.apply_first_row_as_header();
        sheet.set_data_table(table_anchor, Some(table));

        // Position outside table -> regular Pos
        let sheet_pos = SheetPos::new(sheet.id, 1, 1);
        let multi_pos = sheet.convert_to_multi_sheet_pos(sheet_pos);
        assert!(multi_pos.is_pos());
        assert_eq!(multi_pos.as_pos(), Some(Pos::new(1, 1)));

        // Anchor position -> regular Pos (anchor is not converted to TablePos)
        let sheet_pos = SheetPos::new(sheet.id, 2, 3);
        let multi_pos = sheet.convert_to_multi_sheet_pos(sheet_pos);
        assert!(multi_pos.is_pos());

        // Position in table data area (2, 4) -> TablePos(0, 0)
        let sheet_pos = SheetPos::new(sheet.id, 2, 4);
        let multi_pos = sheet.convert_to_multi_sheet_pos(sheet_pos);
        assert!(multi_pos.is_table_pos());
        let table_pos = multi_pos.as_table_pos().unwrap();
        assert_eq!(table_pos.parent_pos, table_anchor);
        assert_eq!(table_pos.sub_table_pos, Pos::new(0, 0));
    }

    #[test]
    fn test_multi_sheet_pos_to_sheet_pos() {
        let mut sheet = Sheet::test();
        let table_anchor = Pos::new(2, 3);

        let mut table = create_test_table(3, 4);
        table.apply_first_row_as_header();
        sheet.set_data_table(table_anchor, Some(table));

        // Regular Pos -> direct conversion
        let multi_pos = MultiSheetPos::from_pos(sheet.id, Pos::new(1, 1));
        let sheet_pos = sheet.multi_sheet_pos_to_sheet_pos(multi_pos);
        assert_eq!(sheet_pos, Some(SheetPos::new(sheet.id, 1, 1)));

        // TablePos (0,0) -> translated position (2, 4)
        let table_pos = TablePos::new(table_anchor, Pos::new(0, 0));
        let multi_pos = MultiSheetPos::from_table_pos(sheet.id, table_pos);
        let sheet_pos = sheet.multi_sheet_pos_to_sheet_pos(multi_pos);
        assert_eq!(sheet_pos, Some(SheetPos::new(sheet.id, 2, 4)));
    }
}
