use crate::controller::active_transactions::transaction_name::TransactionName;
use crate::controller::GridController;

use crate::selection::Selection;
use crate::SheetPos;

impl GridController {
    /// Starts a transaction to set the value of a cell by converting a user's String input
    pub fn set_cell_value(&mut self, sheet_pos: SheetPos, value: String, cursor: Option<String>) {
        let ops = self.set_cell_value_operations(sheet_pos, value);
        self.start_user_transaction(ops, cursor, TransactionName::SetCells, None);
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
                ops.extend(self.set_cell_value_operations(
                    SheetPos {
                        x,
                        y,
                        sheet_id: sheet_pos.sheet_id,
                    },
                    value.to_string(),
                ));
                x += 1;
            }
            x = sheet_pos.x;
            y += 1;
        }
        self.start_user_transaction(ops, cursor, TransactionName::SetCells, None);
    }

    /// Starts a transaction to deletes the cell values and code in a given rect and updates dependent cells.
    pub fn delete_cells(&mut self, selection: &Selection, cursor: Option<String>) {
        let ops = self.delete_cells_operations(selection);
        self.start_user_transaction(ops, cursor, TransactionName::SetCells, None);
    }

    /// Starts a transaction to clear formatting in a given rect.
    pub fn clear_formatting(&mut self, selection: &Selection, cursor: Option<String>) {
        let ops = self.clear_format_selection_operations(selection);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats, None);
    }

    /// Starts a transaction to delete values and formatting in a given rect, and updates dependent cells.
    pub fn delete_values_and_formatting(&mut self, selection: &Selection, cursor: Option<String>) {
        let ops = self.delete_values_and_formatting_operations(selection);
        self.start_user_transaction(ops, cursor, TransactionName::SetCells, None);
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::GridController,
        grid::{NumericDecimals, NumericFormat, SheetId},
        selection::Selection,
        CellValue, Pos, Rect, SheetPos,
    };
    use std::str::FromStr;

    use bigdecimal::BigDecimal;
    use serial_test::parallel;

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
            x: 0,
            y: 0,
            sheet_id,
        };
        let get_cell_value = |g: &GridController| {
            g.sheet(sheet_id)
                .display_value(sheet_pos.into())
                .unwrap_or_default()
        };
        let get_cell_numeric_format = |g: &GridController| {
            g.sheet(sheet_id)
                .get_formatting_value::<NumericFormat>(sheet_pos.into())
        };
        let get_cell_numeric_decimals = |g: &GridController| {
            g.sheet(sheet_id)
                .get_formatting_value::<NumericDecimals>(sheet_pos.into())
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
        assert_eq!(
            get_cell_numeric_format(&gc),
            Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("$".into())
            })
        );
        assert_eq!(get_cell_numeric_decimals(&gc), Some(2));

        // number
        gc.set_cell_value(sheet_pos, "1.22".into(), None);
        assert_eq!(
            get_cell_value(&gc),
            CellValue::Number(BigDecimal::from_str("1.22").unwrap())
        );
        assert_eq!(get_cell_numeric_decimals(&gc), Some(2));

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
        assert_eq!(get_cell_numeric_decimals(&gc), Some(2));

        // array
        gc.set_cell_value(sheet_pos, "[1,2,3]".into(), None);
        assert_eq!(get_cell_value(&gc), CellValue::Text("[1,2,3]".into()));
    }

    #[test]
    fn clear_formatting() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            String::from("1.12345678"),
            None,
        );
        let selection = Selection::pos(0, 0, sheet_id);
        let _ = gc.set_currency_selection(selection.clone(), "$".to_string(), None);
        gc.clear_formatting(&selection, None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }));
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].value, "1.12345678");

        // ensure not found sheet_id fails silently
        gc.clear_formatting(&Selection::pos(0, 0, SheetId::new()), None);
    }

    #[test]
    #[parallel]
    fn delete_values_and_formatting() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            String::from("1.12345678"),
            None,
        );
        let selection = Selection::pos(0, 0, sheet_id);
        let _ = gc.set_currency_selection(selection.clone(), "$".to_string(), None);
        gc.delete_values_and_formatting(&selection, None);
        let cells = gc
            .sheet(sheet_id)
            .get_render_cells(Rect::new_span(Pos { x: 0, y: 0 }, Pos { x: 0, y: 0 }));
        assert_eq!(cells.len(), 0);

        // ensure not found sheet_id fails silently
        gc.delete_values_and_formatting(&Selection::pos(0, 0, SheetId::new()), None);
    }
}
