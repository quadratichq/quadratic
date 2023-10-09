use std::str::FromStr;

use bigdecimal::BigDecimal;

use crate::{
    grid::{CodeCellLanguage, CodeCellValue, NumericFormat, NumericFormatKind, RegionRef, SheetId},
    Array, CellValue, Pos, Rect, RunLengthEncoding,
};

use super::{
    formatting::CellFmtArray, operations::Operation, transaction_summary::TransactionSummary,
    GridController,
};

impl GridController {
    pub fn populate_with_random_floats(&mut self, sheet_id: SheetId, region: &Rect) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.with_random_floats(region);
    }

    /// sets the value based on a user's input and converts input to proper NumericFormat
    pub async fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let region = RegionRef::from(cell_ref);
        let mut ops = vec![];

        // check for currency
        if let Some((currency, number)) = CellValue::unpack_currency(&value) {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values: Array::from(CellValue::Number(number)),
            });
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Currency,
                symbol: Some(currency),
            };
            ops.push(Operation::SetCellFormats {
                region: region.clone(),
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
            ops.push(Operation::SetCellFormats {
                region,
                attr: CellFmtArray::NumericDecimals(RunLengthEncoding::repeat(Some(2), 1)),
            });
        } else if let Ok(bd) = BigDecimal::from_str(&value) {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values: Array::from(CellValue::Number(bd)),
            });
        } else if let Some(percent) = CellValue::unpack_percentage(&value) {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values: Array::from(CellValue::Number(percent)),
            });
            let numeric_format = NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            };
            ops.push(Operation::SetCellFormats {
                region,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            });
        }
        // todo: include other types here
        else {
            let values = Array::from(CellValue::Text(value));
            ops.push(Operation::SetCellValues { region, values });
        }
        self.transact_forward(ops, cursor).await
    }
    pub async fn set_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        values: Array,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_cells_operations(sheet_id, start_pos, values);
        self.transact_forward(ops, cursor).await
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

    pub async fn set_cell_code(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let ops = vec![Operation::SetCellCode {
            cell_ref,
            code_cell_value: Some(CodeCellValue {
                language,
                code_string,
                formatted_code_string: None,
                output: None,

                // todo
                last_modified: String::default(),
            }),
        }];
        self.transact_forward(ops, cursor).await
    }

    pub fn delete_cell_values_operations(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
    ) -> Vec<Operation> {
        let region = self.existing_region(sheet_id, rect);

        match region.size() {
            Some(size) => {
                let values = Array::new_empty(size);
                vec![Operation::SetCellValues { region, values }]
            }
            None => vec![], // region is empty; do nothing
        }
    }

    pub async fn delete_cell_values(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.delete_cell_values_operations(sheet_id, rect);
        self.transact_forward(ops, cursor).await
    }

    pub fn clear_formatting_operations(&mut self, sheet_id: SheetId, rect: Rect) -> Vec<Operation> {
        let region = self.existing_region(sheet_id, rect);

        match region.size() {
            Some(_) => {
                let len = region.size().unwrap().len();
                vec![
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
                ]
            }
            None => vec![],
        }
    }

    pub async fn clear_formatting(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.clear_formatting_operations(sheet_id, rect);
        self.transact_forward(ops, cursor).await
    }

    pub async fn delete_values_and_formatting(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut ops = self.delete_cell_values_operations(sheet_id, rect);
        ops.extend(self.clear_formatting_operations(sheet_id, rect));
        self.transact_forward(ops, cursor).await
    }

    /// Returns a region of the spreadsheet, assigning IDs to columns and rows
    /// as needed.
    pub fn region(&mut self, sheet_id: SheetId, rect: Rect) -> RegionRef {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let columns = rect
            .x_range()
            .map(|x| sheet.get_or_create_column(x).0.id)
            .collect();
        let rows = rect
            .y_range()
            .map(|y| sheet.get_or_create_row(y).id)
            .collect();
        RegionRef {
            sheet: sheet_id,
            columns,
            rows,
        }
    }
    /// Returns a region of the spreadsheet, ignoring columns and rows which
    /// have no contents and no IDs.
    pub fn existing_region(&self, sheet_id: SheetId, rect: Rect) -> RegionRef {
        let sheet = self.grid.sheet_from_id(sheet_id);
        let columns = rect
            .x_range()
            .filter_map(|x| sheet.get_column(x))
            .map(|col| col.id)
            .collect();
        let rows = rect.y_range().filter_map(|y| sheet.get_row(y)).collect();
        RegionRef {
            sheet: sheet_id,
            columns,
            rows,
        }
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::{controller::GridController, CellValue, Pos, Rect};

    #[tokio::test]
    async fn test_set_cell_value_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos = Pos { x: 3, y: 6 };
        let get_the_cell =
            |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
        let expected_cell_regions_modified = vec![(sheet_id, Rect::single_pos(pos))];

        assert_eq!(get_the_cell(&g), CellValue::Blank);
        g.set_cell_value(sheet_id, pos, String::from("a"), None)
            .await;
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        g.set_cell_value(sheet_id, pos, String::from("b"), None)
            .await;
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert_eq!(
            g.undo(None).unwrap().cell_regions_modified,
            expected_cell_regions_modified
        );
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert_eq!(
            g.redo(None).unwrap().cell_regions_modified,
            expected_cell_regions_modified
        );
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert_eq!(
            g.undo(None).unwrap().cell_regions_modified,
            expected_cell_regions_modified
        );
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert_eq!(
            g.undo(None).unwrap().cell_regions_modified,
            expected_cell_regions_modified
        );
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.undo(None).is_none());
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert_eq!(
            g.redo(None).unwrap().cell_regions_modified,
            expected_cell_regions_modified
        );
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert_eq!(
            g.redo(None).unwrap().cell_regions_modified,
            expected_cell_regions_modified
        );
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert!(g.redo(None).is_none());
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
}
