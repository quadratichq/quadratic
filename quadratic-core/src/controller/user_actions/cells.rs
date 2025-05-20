use crate::controller::GridController;
use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::{SheetPos, a1::A1Selection};

impl GridController {
    /// Starts a transaction to set the value of a cell by converting a user's String input
    pub fn set_cell_value(&mut self, sheet_pos: SheetPos, value: String, cursor: Option<String>) {
        self.set_cell_values(sheet_pos, vec![vec![value]], cursor);
    }

    /// Starts a transaction to set cell values using a 2d array of user's &str input where [[1, 2, 3], [4, 5, 6]] creates a grid of width 3 and height 2.
    pub fn set_cell_values(
        &mut self,
        sheet_pos: SheetPos,
        values: Vec<Vec<String>>,
        cursor: Option<String>,
    ) {
        // TODO(ddimaria): implement actuall error bubbling and remove this dbgjs! and return a Result
        match self.set_cell_values_operations(sheet_pos, values) {
            Ok((ops, data_table_ops)) => {
                self.start_user_transaction(ops, cursor.to_owned(), TransactionName::SetCells);

                if !data_table_ops.is_empty() {
                    self.start_user_transaction(data_table_ops, cursor, TransactionName::SetCells);
                }
            }
            Err(e) => dbgjs!(e),
        }
    }

    /// Starts a transaction to deletes the cell values and code in a given rect and updates dependent cells.
    pub fn delete_cells(&mut self, selection: &A1Selection, cursor: Option<String>) {
        let ops = self.delete_cells_operations(selection, true);
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
        CellValue, Pos, Rect, SheetPos,
        a1::A1Selection,
        controller::{GridController, user_actions::import::tests::simple_csv_at},
        grid::{NumericFormat, SheetId, sort::SortDirection},
        test_util::{
            assert_cell_value_col, assert_cell_value_row, assert_display_cell_value_pos,
            print_sheet, print_table_in_rect, str_vec_to_string_vec,
        },
    };
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    #[test]
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
        let cells = gc.sheet(sheet_id).get_render_cells(
            Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 }),
            gc.a1_context(),
        );
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "1.12345678");

        // ensure not found sheet_id fails silently
        let selection = A1Selection::from_xy(1, 1, SheetId::new());
        gc.clear_formatting(&selection, None);
    }

    #[test]
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
        let cells = gc.sheet(sheet_id).get_render_cells(
            Rect::new_span(Pos { x: 1, y: 1 }, Pos { x: 1, y: 1 }),
            gc.a1_context(),
        );
        assert_eq!(cells.len(), 0);

        // ensure not found sheet_id fails silently
        let selection = A1Selection::from_xy(1, 1, SheetId::new());
        gc.delete_values_and_formatting(&selection, None);
    }

    #[test]
    fn test_set_value_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let get_cell = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };

        let get_data_table_value = |gc: &GridController, data_table_pos: Pos, value_pos: Pos| {
            gc.sheet(sheet_id)
                .data_table(data_table_pos)
                .unwrap()
                .value
                .get(value_pos.x as u32, value_pos.y as u32)
                .unwrap()
                .clone()
        };

        let sheet_pos = SheetPos::from((pos![E4], sheet_id));
        assert_eq!(
            get_cell(&gc, sheet_pos),
            CellValue::Text("Southborough".into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 1).into()),
            CellValue::Text("Southborough".into())
        );

        gc.set_cell_value(sheet_pos, "test".into(), None);
        assert_eq!(get_cell(&gc, sheet_pos), CellValue::Text("test".into()));
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 1).into()),
            CellValue::Text("test".into())
        );

        gc.undo(None);
        assert_eq!(
            get_cell(&gc, sheet_pos),
            CellValue::Text("Southborough".into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 1).into()),
            CellValue::Text("Southborough".into())
        );
    }

    #[test]
    fn test_set_value_data_table_first_row_header_and_show_ui() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let get_cell = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };

        let get_data_table_value = |gc: &GridController, data_table_pos: Pos, value_pos: Pos| {
            gc.sheet(sheet_id)
                .data_table(data_table_pos)
                .unwrap()
                .value
                .get(value_pos.x as u32, value_pos.y as u32)
                .unwrap()
                .clone()
        };

        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.header_is_first_row = false;
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E4], sheet_id))),
            CellValue::Text("city".into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 0).into()),
            CellValue::Text("city".into())
        );

        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H5], sheet_id))),
            CellValue::Number(9686.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(9686.into())
        );

        // set value
        gc.set_cell_value(SheetPos::from((pos![E4], sheet_id)), "city1".into(), None);
        gc.set_cell_value(SheetPos::from((pos![H5], sheet_id)), "1111".into(), None);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E4], sheet_id))),
            CellValue::Text("city1".into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 0).into()),
            CellValue::Text("city1".into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H5], sheet_id))),
            CellValue::Number(1111.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(1111.into())
        );

        // show name
        let data_table: &mut crate::grid::DataTable =
            gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.show_name = Some(false);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E3], sheet_id))),
            CellValue::Text("city1".into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H4], sheet_id))),
            CellValue::Number(1111.into())
        );

        // set value
        gc.set_cell_value(SheetPos::from((pos![E3], sheet_id)), "city2".into(), None);
        gc.set_cell_value(SheetPos::from((pos![H4], sheet_id)), "2222".into(), None);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E3], sheet_id))),
            CellValue::Text("city2".into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 0).into()),
            CellValue::Text("city2".into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H4], sheet_id))),
            CellValue::Number(2222.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(2222.into())
        );

        // show columns
        let data_table: &mut crate::grid::DataTable =
            gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.show_columns = Some(false);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E2], sheet_id))),
            CellValue::Text("city2".into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H3], sheet_id))),
            CellValue::Number(2222.into())
        );

        // set the value on the source cell, which is a header since the name is not shown
        gc.set_cell_value(SheetPos::from((pos![E2], sheet_id)), "city3".into(), None);
        gc.set_cell_value(SheetPos::from((pos![H3], sheet_id)), "3333".into(), None);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E2], sheet_id))),
            CellValue::Text("city3".into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (0, 0).into()),
            CellValue::Text("city3".into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H3], sheet_id))),
            CellValue::Number(3333.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(3333.into())
        );

        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.header_is_first_row = true;
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![E2], sheet_id))),
            CellValue::Text("Southborough".into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H2], sheet_id))),
            CellValue::Number(3333.into())
        );
    }

    #[test]
    fn test_set_value_data_table_first_with_hidden_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let get_cell = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };

        let get_data_table_value = |gc: &GridController, data_table_pos: Pos, value_pos: Pos| {
            gc.sheet(sheet_id)
                .data_table(data_table_pos)
                .unwrap()
                .value
                .get(value_pos.x as u32, value_pos.y as u32)
                .unwrap()
                .clone()
        };

        // hide first column
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let column_headers = data_table.column_headers.as_mut().unwrap();
        column_headers[0].display = false;
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![G4], sheet_id))),
            CellValue::Number(9686.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(9686.into())
        );

        // set value
        gc.set_cell_value(SheetPos::from((pos![G4], sheet_id)), "999999".into(), None);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![G4], sheet_id))),
            CellValue::Number(999999.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(999999.into())
        );

        // show first column
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let column_headers = data_table.column_headers.as_mut().unwrap();
        column_headers[0].display = true;
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H4], sheet_id))),
            CellValue::Number(999999.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 1).into()),
            CellValue::Number(999999.into())
        );
    }

    #[test]
    fn test_set_value_data_table_first_with_sort() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let get_cell = |gc: &GridController, sheet_pos: SheetPos| {
            gc.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };

        let get_data_table_value = |gc: &GridController, data_table_pos: Pos, value_pos: Pos| {
            gc.sheet(sheet_id)
                .data_table(data_table_pos)
                .unwrap()
                .value
                .get(value_pos.x as u32, value_pos.y as u32)
                .unwrap()
                .clone()
        };

        // sort column 3 descending
        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_mut(pos).unwrap();
        data_table
            .sort_column(3, SortDirection::Descending)
            .unwrap();
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H4], sheet_id))),
            CellValue::Number(152227.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 5).into()),
            CellValue::Number(152227.into())
        );

        // set value
        gc.set_cell_value(SheetPos::from((pos![H4], sheet_id)), "999999".into(), None);
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H4], sheet_id))),
            CellValue::Number(999999.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 5).into()),
            CellValue::Number(999999.into())
        );

        // remove sort
        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_mut(pos).unwrap();
        data_table.sort_column(3, SortDirection::None).unwrap();
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H4], sheet_id))),
            CellValue::Number(9686.into())
        );
        assert_eq!(
            get_cell(&gc, SheetPos::from((pos![H8], sheet_id))),
            CellValue::Number(999999.into())
        );
        assert_eq!(
            get_data_table_value(&gc, pos, (3, 5).into()),
            CellValue::Number(999999.into())
        );
    }

    #[test]
    fn test_expand_data_table_column_row_on_setting_value() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));
        let sheet_pos = SheetPos::from((pos, sheet_id));

        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 8, 13));

        print_table_in_rect(&gc, sheet_id, Rect::new(5, 2, 8, 13));

        // hide first column
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let mut column_headers = data_table.column_headers.to_owned().unwrap();
        column_headers[0].display = false;
        gc.test_data_table_update_meta(sheet_pos, Some(column_headers), None, None);

        print_table_in_rect(&gc, sheet_id, Rect::new(5, 2, 10, 13));
        // assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 7, 13));

        gc.set_cell_value(SheetPos::from((8, 4, sheet_id)), "test1".into(), None);

        print_table_in_rect(&gc, sheet_id, Rect::new(5, 2, 10, 13));

        // column expand
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 8, 13));
        assert_eq!(
            data_table.cell_value_at(3, 2),
            Some(CellValue::Text("test1".into()))
        );

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 7, 13));
        assert_eq!(
            sheet.cell_value(pos![H4]),
            Some(CellValue::Text("test1".into()))
        );

        gc.set_cell_value(SheetPos::from((8, 6, sheet_id)), "test2".into(), None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 7, 13));
        assert_eq!(
            sheet.cell_value(pos![H6]),
            Some(CellValue::Text("test2".into()))
        );

        // row expand
        gc.set_cell_value(SheetPos::from((6, 14, sheet_id)), "test3".into(), None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 7, 14));
        assert_eq!(
            data_table.cell_value_at(1, 12),
            Some(CellValue::Text("test3".into()))
        );

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 7, 13));
        assert_eq!(
            sheet.cell_value(pos![F14]),
            Some(CellValue::Text("test3".into()))
        );

        gc.set_cell_value(SheetPos::from((8, 14, sheet_id)), "test4".into(), None);

        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(5, 2, 7, 13));
        assert_eq!(
            sheet.cell_value(pos![H14]),
            Some(CellValue::Text("test4".into()))
        );
    }

    #[test]
    fn test_set_cell_values_grid() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet_pos = SheetPos::from((pos![A1], sheet_id));
        let values = vec![vec!["a".into(), "b".into(), "c".into()]];

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 1));

        gc.set_cell_values(sheet_pos, values, None);

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 1));

        assert_display_cell_value_pos(&gc, sheet_id, pos![A1], "a");
        assert_display_cell_value_pos(&gc, sheet_id, pos![B1], "b");
        assert_display_cell_value_pos(&gc, sheet_id, pos![C1], "c");
    }

    #[test]
    fn test_set_cell_values_within_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv_at(pos!(A1));
        let sheet_pos = SheetPos::from((pos![A3], sheet_id));
        let values = vec![vec!["a".into(), "b".into(), "c".into()]];

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 10, 12));

        gc.set_cell_values(sheet_pos, values, None);

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 10, 12));

        assert_display_cell_value_pos(&gc, sheet_id, pos![A3], "a");
        assert_display_cell_value_pos(&gc, sheet_id, pos![B3], "b");
        assert_display_cell_value_pos(&gc, sheet_id, pos![C3], "c");
    }

    #[test]
    fn test_set_cell_values_grow_data_table_bottom() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(A1));
        let sheet_pos = SheetPos::from((pos![A13], sheet_id));
        let row_1_values = vec!["a", "b", "c"];
        let row_2_values = vec!["d", "e", "f"];
        let values = vec![
            str_vec_to_string_vec(&row_1_values),
            str_vec_to_string_vec(&row_2_values),
        ];
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();

        assert_eq!(data_table.output_rect(pos, false), Rect::new(1, 1, 4, 12));

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 10, 12));

        gc.set_cell_values(sheet_pos, values, None);

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 12, 13));

        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(1, 1, 4, 14));

        assert_cell_value_row(&gc, sheet_id, 1, 3, 13, row_1_values);
        assert_cell_value_row(&gc, sheet_id, 1, 3, 14, row_2_values);
    }

    #[test]
    fn test_set_cell_values_grow_data_table_right() {
        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(A1));
        let sheet_pos = SheetPos::from((pos![E3], sheet_id));
        let values = vec![
            vec!["a".into(), "d".into()],
            vec!["b".into(), "e".into()],
            vec!["c".into(), "f".into()],
        ];
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();

        assert_eq!(data_table.output_rect(pos, false), Rect::new(1, 1, 4, 12));

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 12));

        gc.set_cell_values(sheet_pos, values, None);

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 6, 12));

        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        assert_eq!(data_table.output_rect(pos, false), Rect::new(1, 1, 6, 12));

        print_sheet(gc.sheet(sheet_id));

        assert_cell_value_col(&gc, sheet_id, 5, 3, 5, vec!["a", "b", "c"]);
        assert_cell_value_col(&gc, sheet_id, 6, 3, 5, vec!["d", "e", "f"]);
    }
}
