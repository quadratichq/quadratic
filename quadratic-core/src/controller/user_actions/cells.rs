use crate::controller::{transaction_summary::TransactionSummary, GridController};

use crate::{grid::CodeCellLanguage, SheetPos, SheetRect};

impl GridController {
    /// Starts a transaction to set the value of a cell by converting a user's String input
    ///
    /// Returns a [`TransactionSummary`].
    pub fn set_cell_value(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_cell_value_operations(sheet_pos, value);
        self.start_user_transaction(ops, cursor)
    }

    /// Starts a transaction to set cell values using a 2d array of user's &str input where [[1, 2, 3], [4, 5, 6]] creates a grid of width 3 and height 2.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn set_cell_values(
        &mut self,
        sheet_pos: SheetPos,
        values: Vec<Vec<&str>>,
        cursor: Option<String>,
    ) -> TransactionSummary {
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
        self.start_user_transaction(ops, cursor)
    }

    /// Starts a transaction to set a code_cell using user's code_string input
    ///
    /// Returns a [`TransactionSummary`].
    pub fn set_code_cell(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_code_cell_operations(sheet_pos, language, code_string);
        self.start_user_transaction(ops, cursor)
    }

    /// Starts a transaction to deletes the cell values and code in a given rect and updates dependent cells.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn delete_cells_rect(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.delete_cells_rect_operations(sheet_rect);
        self.start_user_transaction(ops, cursor)
    }

    /// Starts a transaction to clear formatting in a given rect.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn clear_formatting(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.clear_formatting_operations(sheet_rect);
        self.start_user_transaction(ops, cursor)
    }

    /// Starts a transaction to delete values and formatting in a given rect, and updates dependent cells.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn delete_values_and_formatting(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.delete_values_and_formatting_operations(sheet_rect);
        self.start_user_transaction(ops, cursor)
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{transaction_summary::CellSheetsModified, GridController},
        grid::{NumericDecimals, NumericFormat, SheetId},
        CellValue, SheetPos,
    };
    use std::{collections::HashSet, str::FromStr};

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
        let mut cell_sheets_modified = HashSet::new();
        cell_sheets_modified.insert(CellSheetsModified::new(sheet_pos));
        assert_eq!(get_cell(&g), CellValue::Blank);

        // test undo/redo of a single cell value and ensure that cell_sheets_modified is properly populated for the renderer
        let summary = g.set_cell_value(sheet_pos, String::from("a"), None);
        assert_eq!(summary.cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        let summary = g.set_cell_value(sheet_pos, String::from("b"), None);
        assert_eq!(summary.cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        assert_eq!(g.undo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        assert_eq!(g.redo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        assert_eq!(g.undo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        assert_eq!(g.undo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Blank);

        assert_eq!(g.undo(None).cell_sheets_modified, HashSet::default());
        assert_eq!(get_cell(&g), CellValue::Blank);

        assert_eq!(g.redo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("a")));

        assert_eq!(g.redo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_cell(&g), CellValue::Text(String::from("b")));

        assert_eq!(g.redo(None).cell_sheets_modified, HashSet::default());
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
}
