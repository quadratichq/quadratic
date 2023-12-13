use std::str::FromStr;

use bigdecimal::BigDecimal;

use crate::{
    grid::{
        generate_borders, BorderSelection, CodeCellLanguage, CodeCellValue, NumericDecimals,
        NumericFormat, NumericFormatKind, SheetId,
    },
    util::date_string,
    Array, CellValue, Rect, RunLengthEncoding, SheetPos, SheetRect,
};

use super::{
    formatting::CellFmtArray, operation::Operation, transaction_in_progress::TransactionType,
    transaction_summary::TransactionSummary, GridController,
};

impl GridController {
    pub fn populate_with_random_floats(&mut self, sheet_id: SheetId, region: &Rect) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.with_random_floats(region);
    }

    /// sets the value based on a user's input and converts input to proper NumericFormat
    pub fn set_cell_value(
        &mut self,
        sheet_pos: SheetPos,
        value: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut ops = vec![];
        let cell_value = self.string_to_cell_value(sheet_pos, value.as_str(), &mut ops);

        ops.push(Operation::SetCellValues {
            sheet_rect: sheet_pos.into(),
            values: Array::from(cell_value),
        });

        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    pub fn string_to_cell_value(
        &mut self,
        sheet_pos: SheetPos,
        value: &str,
        ops: &mut Vec<Operation>,
    ) -> CellValue {
        let sheet = self.grid.sheet_mut_from_id(sheet_pos.sheet_id);
        let sheet_rect = SheetRect::from(sheet_pos);

        // strip whitespace
        let value = value.trim();

        if value.is_empty() {
            CellValue::Blank
        } else if let Some((currency, number)) = CellValue::unpack_currency(value) {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some(currency),
            };
            ops.push(Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
            // only change decimal places if decimals have not been set
            if sheet
                .get_formatting_value::<NumericDecimals>(sheet_pos.into())
                .is_none()
            {
                ops.push(Operation::SetCellFormats {
                    sheet_rect,
                    attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
                });
            }
            CellValue::Number(number)
        } else if let Ok(bd) = BigDecimal::from_str(value) {
            CellValue::Number(bd)
        } else if let Some(percent) = CellValue::unpack_percentage(value) {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            };
            ops.push(Operation::SetCellFormats {
                sheet_rect,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });

            CellValue::Number(percent)
        } else {
            CellValue::Text(value.into())
        }
    }

    pub fn set_cell_code(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_pos.sheet_id);
        let mut ops = vec![];

        // remove any values that were originally over the code cell
        if sheet.get_cell_value_only(sheet_pos.into()).is_some() {
            ops.push(Operation::SetCellValues {
                sheet_rect: SheetRect::from(sheet_pos),
                values: Array::from(CellValue::Blank),
            });
        }

        ops.push(Operation::SetCellCode {
            sheet_pos,
            code_cell_value: Some(CodeCellValue {
                language,
                code_string,
                formatted_code_string: None,
                output: None,
                last_modified: date_string(),
            }),
        });
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    /// Generates and returns the set of operations to deleted the values and code in a given region
    /// Does not commit the operations or create a transaction.
    pub fn delete_cells_rect_operations(&mut self, sheet_rect: SheetRect) -> Vec<Operation> {
        let mut ops = vec![];
        let values = Array::new_empty(sheet_rect.size());
        ops.push(Operation::SetCellValues {
            sheet_rect: sheet_rect.clone(),
            values,
        });

        let sheet = self.grid.sheet_from_id(sheet_rect.sheet_id);

        // collect all the code cells in the region
        for pos in sheet.code_cells.keys() {
            if sheet_rect.contains(pos.to_sheet_pos(sheet_rect.sheet_id)) {
                ops.push(Operation::SetCellCode {
                    sheet_pos: pos.to_sheet_pos(sheet_rect.sheet_id),
                    code_cell_value: None,
                });
            }
        }
        ops
    }

    /// Deletes the cell values and code in a given region.
    /// Creates and runs a transaction, also updates dependent cells.
    /// Returns a [`TransactionSummary`].
    pub fn delete_cells_rect(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.delete_cells_rect_operations(sheet_rect);
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    pub fn clear_formatting_operations(&mut self, sheet_rect: SheetRect) -> Vec<Operation> {
        let len = sheet_rect.size().len();
        let mut ops = vec![
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::Align(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::Wrap(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::Bold(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::Italic(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::TextColor(RunLengthEncoding::repeat(None, len)),
            },
            Operation::SetCellFormats {
                sheet_rect: sheet_rect.clone(),
                attr: CellFmtArray::FillColor(RunLengthEncoding::repeat(None, len)),
            },
        ];

        // clear borders
        let sheet = self.grid.sheet_from_id(sheet_rect.sheet_id);
        let borders = generate_borders(
            sheet,
            &sheet_rect.into(),
            vec![BorderSelection::Clear],
            None,
        );
        ops.push(Operation::SetBorders {
            sheet_rect,
            borders,
        });
        ops
    }

    pub fn clear_formatting(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.clear_formatting_operations(sheet_rect);
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }

    pub fn delete_values_and_formatting(
        &mut self,
        sheet_rect: SheetRect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut ops = self.delete_cells_rect_operations(sheet_rect);
        ops.extend(self.clear_formatting_operations(sheet_rect));
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{transaction_summary::CellSheetsModified, GridController},
        grid::{NumericDecimals, NumericFormat},
        CellValue, SheetPos,
    };
    use std::{collections::HashSet, str::FromStr};

    use bigdecimal::BigDecimal;

    #[test]
    fn test_set_cell_value_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let sheet_pos = SheetPos {
            x: 3,
            y: 6,
            sheet_id,
        };
        let get_the_cell = |g: &GridController| {
            g.sheet(sheet_id)
                .get_cell_value(sheet_pos.into())
                .unwrap_or_default()
        };
        let mut cell_sheets_modified = HashSet::new();
        cell_sheets_modified.insert(CellSheetsModified::new(sheet_pos));
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        g.set_cell_value(sheet_pos, String::from("a"), None);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        g.set_cell_value(sheet_pos, String::from("b"), None);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert_eq!(g.undo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert_eq!(g.redo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert_eq!(g.undo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert_eq!(g.undo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert_eq!(g.undo(None).cell_sheets_modified, HashSet::default());
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert_eq!(g.redo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert_eq!(g.redo(None).cell_sheets_modified, cell_sheets_modified);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert_eq!(g.redo(None).cell_sheets_modified, HashSet::default());
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
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
        let mut gc = GridController::new();
        let sheet_id = gc.grid.sheets()[0].id;
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let get_cell_value = |g: &GridController| {
            g.sheet(sheet_id)
                .get_cell_value(sheet_pos.into())
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
