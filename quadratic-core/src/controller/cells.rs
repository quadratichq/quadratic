use std::str::FromStr;

use bigdecimal::BigDecimal;

use crate::{
    grid::{
        generate_borders, BorderSelection, CodeCellLanguage, CodeCellValue, NumericDecimals,
        NumericFormat, NumericFormatKind, RegionRef, SheetId,
    },
    Array, CellValue, Pos, Rect, RunLengthEncoding,
};

use super::{
    formatting::CellFmtArray, operation::Operation, transaction_summary::TransactionSummary,
    transactions::TransactionType, GridController,
};

impl GridController {
    pub fn populate_with_random_floats(&mut self, sheet_id: SheetId, region: &Rect) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.with_random_floats(region);
    }

    /// sets the value based on a user's input and converts input to proper NumericFormat
    pub fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let mut ops = vec![];

        let cell_value = self.string_to_cell_value(sheet_id, pos, value.as_str(), &mut ops);

        ops.push(Operation::SetCellValues {
            region: RegionRef::from(cell_ref),
            values: Array::from(cell_value),
        });

        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    pub fn string_to_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: &str,
        formatting_ops: &mut Vec<Operation>,
    ) -> CellValue {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let region = RegionRef::from(cell_ref);

        // strip whitespace
        let value = value.trim();

        if value.is_empty() {
            return CellValue::Blank;
        } else if let Some((currency, number)) = CellValue::unpack_currency(value) {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some(currency),
            };
            formatting_ops.push(Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
            // only change decimal places if decimals have not been set
            if sheet.get_formatting_value::<NumericDecimals>(pos).is_none() {
                formatting_ops.push(Operation::SetCellFormats {
                    region,
                    attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
                });
            }
            return CellValue::Number(number);
        } else if let Ok(bd) = BigDecimal::from_str(value) {
            return CellValue::Number(bd);
        } else if let Some(percent) = CellValue::unpack_percentage(value) {
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            };
            formatting_ops.push(Operation::SetCellFormats {
                region,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
            return CellValue::Number(percent);
        } else {
            return CellValue::Text(value.into());
        }
    }

    pub fn set_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        values: Array,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_cells_operations(sheet_id, start_pos, values);
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }
    pub fn set_cells_operations(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        values: Array,
    ) -> Vec<Operation> {
        let end_pos = Pos {
            x: start_pos.x + values.width() as i64 - 1,
            y: start_pos.y + values.height() as i64 - 1,
        };
        let rect = Rect {
            min: start_pos,
            max: end_pos,
        };
        let region = self.region(sheet_id, rect);
        vec![Operation::SetCellValues { region, values }]
    }

    pub fn set_cell_code(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let mut ops = vec![];

        // remove any values that were originally over the code cell
        if sheet.get_cell_value(pos).is_some() {
            ops.push(Operation::SetCellValues {
                region: RegionRef::from(cell_ref),
                values: Array::from(CellValue::Blank),
            });
        }

        ops.push(Operation::SetCellCode {
            cell_ref,
            code_cell_value: Some(CodeCellValue {
                language,
                code_string,
                formatted_code_string: None,
                output: None,

                // todo
                last_modified: String::default(),
            }),
        });
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    /// Generates and returns the set of operations to deleted the values in a given region
    /// Does not commit the operations or create a transaction.
    pub fn delete_cell_values_operations(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
    ) -> Vec<Operation> {
        let region = self.existing_region(sheet_id, rect);
        let mut ops = vec![];
        if let Some(size) = region.size() {
            let values = Array::new_empty(size);
            ops.push(Operation::SetCellValues { region, values });

            // need to walk through the region and delete code cells
            let sheet = self.grid.sheet_from_id(sheet_id);
            for x in rect.x_range() {
                let column = sheet.get_column(x);
                for y in rect.y_range() {
                    // todo: good place to check for spills here

                    // skip deleting the code cell if there is a value (since you have to delete that first)
                    if column.is_some_and(|column| column.values.get(y).is_some()) {
                        continue;
                    } else {
                        // delete code cell if it exists
                        let pos = Pos { x, y };
                        if sheet.get_code_cell(pos).is_some() {
                            if let Some(cell_ref) = sheet.try_get_cell_ref(pos) {
                                ops.push(Operation::SetCellCode {
                                    cell_ref,
                                    code_cell_value: None,
                                });
                            };
                        }
                    }
                }
            }
        };
        ops
    }

    /// Deletes the cells in a given region.
    /// Creates and runs a transaction, also updates dependent cells.
    /// Returns a [`TransactionSummary`].
    pub fn delete_cell_values(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.delete_cell_values_operations(sheet_id, rect);
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    pub fn clear_formatting_operations(&mut self, sheet_id: SheetId, rect: Rect) -> Vec<Operation> {
        let region = self.existing_region(sheet_id, rect);
        match region.size() {
            Some(_) => {
                let len = region.size().unwrap().len();
                let mut ops = vec![
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::Align(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::Wrap(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::Bold(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::Italic(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::TextColor(RunLengthEncoding::repeat(None, len)),
                    },
                    Operation::SetCellFormats {
                        region: region.clone(),
                        attr: CellFmtArray::FillColor(RunLengthEncoding::repeat(None, len)),
                    },
                ];

                // clear borders
                let sheet = self.grid.sheet_from_id(sheet_id);
                let borders = generate_borders(sheet, &region, vec![BorderSelection::Clear], None);
                ops.push(Operation::SetBorders {
                    region: region.clone(),
                    borders,
                });
                ops
            }
            None => vec![],
        }
    }

    pub fn clear_formatting(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.clear_formatting_operations(sheet_id, rect);
        self.set_in_progress_transaction(ops, cursor, false, TransactionType::Normal)
    }

    pub fn delete_values_and_formatting(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut ops = self.delete_cell_values_operations(sheet_id, rect);
        ops.extend(self.clear_formatting_operations(sheet_id, rect));
        self.set_in_progress_transaction(ops, cursor, true, TransactionType::Normal)
    }

    /// Returns a region of the spreadsheet, assigning IDs to columns and rows
    /// as needed.
    pub fn region(&mut self, sheet_id: SheetId, rect: Rect) -> RegionRef {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.region(rect)
    }
    /// Returns a region of the spreadsheet, ignoring columns and rows which
    /// have no contents and no IDs.
    pub fn existing_region(&self, sheet_id: SheetId, rect: Rect) -> RegionRef {
        let sheet = self.grid.sheet_from_id(sheet_id);
        sheet.existing_region(rect)
    }
}

#[cfg(test)]
mod test {
    use crate::{
        controller::{transaction_summary::CellSheetsModified, GridController},
        grid::{NumericDecimals, NumericFormat},
        CellValue, Pos,
    };
    use std::{collections::HashSet, str::FromStr};

    use bigdecimal::BigDecimal;

    #[test]
    fn test_set_cell_value_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos = Pos { x: 3, y: 6 };
        let get_the_cell =
            |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
        let mut cell_sheets_modified = HashSet::new();
        cell_sheets_modified.insert(CellSheetsModified::new(sheet_id, pos));
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        g.set_cell_value(sheet_id, pos, String::from("a"), None);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        g.set_cell_value(sheet_id, pos, String::from("b"), None);
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
        let pos = Pos { x: 0, y: 0 };
        let get_cell_value =
            |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
        let get_cell_numeric_format =
            |g: &GridController| g.sheet(sheet_id).get_formatting_value::<NumericFormat>(pos);
        let get_cell_numeric_decimals = |g: &GridController| {
            g.sheet(sheet_id)
                .get_formatting_value::<NumericDecimals>(pos)
        };

        // empty string converts to blank cell value
        gc.set_cell_value(sheet_id, pos, " ".into(), None);
        assert_eq!(get_cell_value(&gc), CellValue::Blank);

        // currency
        gc.set_cell_value(sheet_id, pos, "$1.22".into(), None);
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
        gc.set_cell_value(sheet_id, pos, "1.22".into(), None);
        assert_eq!(
            get_cell_value(&gc),
            CellValue::Number(BigDecimal::from_str("1.22").unwrap())
        );
        assert_eq!(get_cell_numeric_decimals(&gc), Some(2));

        // percentage
        gc.set_cell_value(sheet_id, pos, "10.55%".into(), None);
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
        gc.set_cell_value(sheet_id, pos, "[1,2,3]".into(), None);
        assert_eq!(get_cell_value(&gc), CellValue::Text("[1,2,3]".into()));
    }
}
