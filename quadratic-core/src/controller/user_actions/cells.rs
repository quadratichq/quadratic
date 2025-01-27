use anyhow::Result;

use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;
use crate::grid::column_header::DataTableColumnHeader;
use crate::Pos;
use crate::{a1::A1Selection, CellValue, SheetPos};

impl GridController {
    // Using sheet_pos, either set a cell value or a data table value
    pub fn set_value(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
        cursor: Option<String>,
    ) -> Result<()> {
        let sheet = self.try_sheet_mut_result(sheet_pos.sheet_id)?;

        let cell_value = sheet
            .get_column(sheet_pos.x)
            .and_then(|column| column.values.get(&sheet_pos.y));

        let is_data_table = if let Some(cell_value) = cell_value {
            matches!(cell_value, CellValue::Code(_) | CellValue::Import(_))
        } else {
            sheet.has_table_content(sheet_pos.into())
        };

        match is_data_table {
            true => self.set_data_table_value(sheet_pos, value, cursor),
            false => self.set_cell_value(sheet_pos, value, cursor),
        };

        Ok(())
    }

    /// Starts a transaction to set the value of a cell by converting a user's String input
    pub fn set_cell_value(&mut self, sheet_pos: SheetPos, value: String, cursor: Option<String>) {
        let mut data_table_ops = vec![];
        let pos = Pos::from(sheet_pos);

        if let Ok(sheet) = self.try_sheet_mut_result(sheet_pos.sheet_id) {
            if pos.x > 1 && pos.y > 1 {
                let data_table_left = sheet.first_data_table_within(Pos::new(pos.x - 1, pos.y));
                if let Ok(data_table_left) = data_table_left {
                    if let Some(data_table) = sheet
                        .data_table(data_table_left)
                        .filter(|data_table| !data_table.readonly)
                    {
                        let y = pos.y - data_table_left.y;

                        // header row
                        if y == 0 {
                            let value_index = data_table.column_headers_len();
                            let column_header =
                                DataTableColumnHeader::new(value.to_owned(), true, value_index);
                            let columns =
                                data_table.column_headers.to_owned().map(|mut headers| {
                                    headers.push(column_header);
                                    headers
                                });

                            data_table_ops.push(Operation::DataTableMeta {
                                sheet_pos: (data_table_left, sheet_pos.sheet_id).into(),
                                name: None,
                                alternating_colors: None,
                                columns,
                                show_ui: None,
                                show_name: None,
                                show_columns: None,
                            });
                        } else {
                            let mut values = vec![CellValue::Blank; data_table.height(true)];
                            values[y as usize] = value.to_owned().into();

                            data_table_ops.push(Operation::InsertDataTableColumn {
                                sheet_pos: (data_table_left, sheet_pos.sheet_id).into(),
                                index: (data_table.width()) as u32,
                                column_header: None,
                                values: Some(values),
                            });
                        }
                    }
                }

                let data_table_above = sheet.first_data_table_within(Pos::new(pos.x, pos.y - 1));

                if let Ok(data_table_above) = data_table_above {
                    if let Some(data_table) = sheet
                        .data_table(data_table_above)
                        .filter(|data_table| !data_table.readonly)
                    {
                        let x = pos.x - data_table_above.x;
                        let mut values = vec![CellValue::Blank; data_table.width()];
                        values[x as usize] = value.to_owned().into();

                        data_table_ops.push(Operation::InsertDataTableRow {
                            sheet_pos: (data_table_above, sheet_pos.sheet_id).into(),
                            index: data_table.height(true) as u32,
                            values: Some(values),
                        });
                    }
                }
            }
        }

        let ops = self.set_cell_value_operations(sheet_pos, value);
        self.start_user_transaction(ops, cursor.to_owned(), TransactionName::SetCells);

        if !data_table_ops.is_empty() {
            self.start_user_transaction(data_table_ops, cursor, TransactionName::SetCells);
        }
    }

    /// Starts a transaction to set cell values using a 2d array of user's &str input where [[1, 2, 3], [4, 5, 6]] creates a grid of width 3 and height 2.
    pub fn set_cell_values(
        &mut self,
        sheet_pos: SheetPos,
        values: Vec<Vec<&str>>,
        cursor: Option<String>,
    ) {
        let mut ops = vec![];
        let mut x = sheet_pos.x;
        let mut y = sheet_pos.y;

        for row in values {
            for value in row {
                let op_sheet_pos = SheetPos::new(sheet_pos.sheet_id, x, y);
                ops.extend(self.set_cell_value_operations(op_sheet_pos, value.to_string()));
                x += 1;
            }
            x = sheet_pos.x;
            y += 1;
        }
        self.start_user_transaction(ops, cursor, TransactionName::SetCells);
    }

    /// Starts a transaction to deletes the cell values and code in a given rect and updates dependent cells.
    pub fn delete_cells(&mut self, selection: &A1Selection, cursor: Option<String>) {
        let ops = self.delete_cells_operations(selection, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetCells);
    }

    /// Starts a transaction to clear formatting in a given rect.
    pub fn clear_formatting(&mut self, selection: &A1Selection, cursor: Option<String>) {
        let ops = self.clear_format_borders_operations(selection);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }

    /// Starts a transaction to delete values and formatting in a given rect, and updates dependent cells.
    pub fn delete_values_and_formatting(
        &mut self,
        selection: &A1Selection,
        cursor: Option<String>,
    ) {
        let ops = self.delete_values_and_formatting_operations(selection, false);
        self.start_user_transaction(ops, cursor, TransactionName::SetCells);
    }
}

#[cfg(test)]
mod test {
    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::{NumericFormat, SheetId},
        CellValue, Pos, Rect, SheetPos,
    };
    use std::str::FromStr;

    use bigdecimal::BigDecimal;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_set_cell_value_undo_redo() {
        let mut g = GridController::test();
        let sheet_id = g.grid.sheets()[0].id;
        let sheet_pos = SheetPos {
            x: 3,
            y: 6,
            sheet_id,
        };
        let get_cell = |g: &GridController| {
            g.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };
        assert_eq!(get_cell(&g), CellValue::Blank);

        // test undo/redo of a single cell value and ensure that cell_sheets_modified is properly populated for the renderer
        g.set_cell_value(sheet_pos, String::from("a"), None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        g.set_cell_value(sheet_pos, String::from("b"), None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        g.undo(None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        g.redo(None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        g.undo(None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        g.undo(None);
        assert_eq!(get_cell(&g), CellValue::Blank);

        g.undo(None);
        assert_eq!(get_cell(&g), CellValue::Blank);

        g.redo(None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        g.redo(None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        g.redo(None);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        // ensure that not found SheetId fails silently
        g.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id: SheetId::new(),
            },
            String::from("c"),
            None,
        );
    }

    #[test]
    #[parallel]
    fn test_unpack_currency() {
        let value = String::from("$123.123");
        assert_eq!(
            CellValue::unpack_currency(&value),
            Some((String::from("$"), BigDecimal::from_str("123.123").unwrap()))
        );

        let value = String::from("test");
        assert_eq!(CellValue::unpack_currency(&value), None);

        let value = String::from("$123$123");
        assert_eq!(CellValue::unpack_currency(&value), None);

        let value = String::from("$123.123abc");
        assert_eq!(CellValue::unpack_currency(&value), None);
    }

    #[test]
    #[parallel]
    fn test_set_cell_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet_pos = SheetPos {
            x: 1,
            y: 2,
            sheet_id,
        };
        let get_cell_value = |g: &GridController| {
            g.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };
        let get_cell_numeric_commas = |g: &GridController| {
            g.sheet(sheet_id)
                .formats
                .numeric_commas
                .get(sheet_pos.into())
        };
        let get_cell_numeric_format = |g: &GridController| {
            g.sheet(sheet_id)
                .formats
                .numeric_format
                .get(sheet_pos.into())
        };
        let get_cell_numeric_decimals = |g: &GridController| {
            g.sheet(sheet_id)
                .formats
                .numeric_decimals
                .get(sheet_pos.into())
        };

        // empty string converts to blank cell value
        gc.set_cell_value(sheet_pos, " ".into(), None);
        assert_eq!(get_cell_value(&gc), CellValue::Blank);

        // currency
        gc.set_cell_value(sheet_pos, "$1.22".into(), None);
        assert_eq!(
            get_cell_value(&gc),
            CellValue::Number(BigDecimal::from_str("1.22").unwrap())
        );
        assert_eq!(get_cell_numeric_commas(&gc), None);
        assert_eq!(
            get_cell_numeric_format(&gc),
            Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("$".into())
            })
        );
        assert_eq!(get_cell_numeric_decimals(&gc), None);

        // number
        gc.set_cell_value(sheet_pos, "1.22".into(), None);
        assert_eq!(
            get_cell_value(&gc),
            CellValue::Number(BigDecimal::from_str("1.22").unwrap())
        );
        assert_eq!(get_cell_numeric_decimals(&gc), None);

        // percentage
        gc.set_cell_value(sheet_pos, "10.55%".into(), None);
        assert_eq!(
            get_cell_value(&gc),
            CellValue::Number(BigDecimal::from_str(".1055").unwrap())
        );
        assert_eq!(
            get_cell_numeric_format(&gc),
            Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Percentage,
                symbol: None
            })
        );
        assert_eq!(get_cell_numeric_decimals(&gc), None);

        // array
        gc.set_cell_value(sheet_pos, "[1,2,3]".into(), None);
        assert_eq!(get_cell_value(&gc), CellValue::Text("[1,2,3]".into()));
    }

    #[test]
    #[parallel]
    fn clear_formatting() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_cell_value(sheet_pos, String::from("1.12345678"), None);
        let selection = A1Selection::from_single_cell(sheet_pos);
        let _ = gc.set_currency(&selection, "$".to_string(), None);
        gc.clear_formatting(&selection, None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 }));
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "1.12345678");

        // ensure not found sheet_id fails silently
        let selection = A1Selection::from_xy(1, 1, SheetId::new());
        gc.clear_formatting(&selection, None);
    }

    #[test]
    #[parallel]
    fn delete_values_and_formatting() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        gc.set_cell_value(sheet_pos, String::from("1.12345678"), None);
        let selection = A1Selection::from_single_cell(sheet_pos);
        let _ = gc.set_currency(&selection, "$".to_string(), None);
        gc.delete_values_and_formatting(&selection, None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 }));
        assert_eq!(cells.len(), 0);

        // ensure not found sheet_id fails silently
        let selection = A1Selection::from_xy(1, 1, SheetId::new());
        gc.delete_values_and_formatting(&selection, None);
    }
}
