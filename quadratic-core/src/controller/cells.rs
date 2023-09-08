use std::str::FromStr;

use bigdecimal::{BigDecimal, FromPrimitive};

use crate::{
    grid::{NumericFormat, NumericFormatKind, RegionRef, SheetId},
    Array, CellValue, Pos, Rect, RunLengthEncoding,
};

use super::{
    formatting::CellFmtArray,
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};

// todo: fill this out
const CURRENCY_SYMBOLS: &str = "$€£¥";

impl GridController {
    pub fn populate_with_random_floats(&mut self, sheet_id: SheetId, region: &Rect) {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        sheet.with_random_floats(region);
    }

    /// tests whether a a CellValue::Text is a currency value
    fn unpack_currency(s: &String) -> Option<(String, BigDecimal)> {
        if s.is_empty() {
            return None;
        }
        for char in CURRENCY_SYMBOLS.chars() {
            if let Some(stripped) = s.strip_prefix(char) {
                if let Ok(bd) = BigDecimal::from_str(stripped) {
                    return Some((char.to_string(), bd));
                }
            }
        }
        None
    }

    fn unpack_percentage(s: &String) -> Option<BigDecimal> {
        if s.is_empty() {
            return None;
        }
        if let Some(number) = s.strip_suffix('%') {
            if let Ok(bd) = BigDecimal::from_str(number) {
                return Some(bd / BigDecimal::from_i8(100).unwrap());
            }
        }
        None
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
        let region = RegionRef::from(cell_ref);
        let mut ops = vec![];

        // check for currency
        if let Some((currency, number)) = Self::unpack_currency(&value) {
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
        } else if let Some(percent) = Self::unpack_percentage(&value) {
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
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn set_cells(
        &mut self,
        sheet_id: SheetId,
        start_pos: Pos,
        values: Array,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let end_pos = Pos {
            x: start_pos.x + values.width() as i64 - 1,
            y: start_pos.y + values.height() as i64 - 1,
        };
        let rect = Rect {
            min: start_pos,
            max: end_pos,
        };
        let region = self.region(sheet_id, rect);
        let ops = vec![Operation::SetCellValues { region, values }];
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn delete_cell_values(
        &mut self,
        sheet_id: SheetId,
        rect: Rect,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let region = self.existing_region(sheet_id, rect);
        let ops = match region.size() {
            Some(size) => {
                let values = Array::new_empty(size);
                vec![Operation::SetCellValues { region, values }]
            }
            None => vec![], // region is empty; do nothing
        };
        self.transact_forward(Transaction { ops, cursor })
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

    use crate::{
        controller::{transactions::TransactionSummary, GridController},
        CellValue, Pos, Rect,
    };

    #[test]
    fn test_set_cell_value_undo_redo() {
        let mut g = GridController::new();
        let sheet_id = g.grid.sheets()[0].id;
        let pos = Pos { x: 3, y: 6 };
        let get_the_cell =
            |g: &GridController| g.sheet(sheet_id).get_cell_value(pos).unwrap_or_default();
        let expected_summary = Some(TransactionSummary {
            cell_regions_modified: vec![(sheet_id, Rect::single_pos(pos))],
            ..Default::default()
        });

        assert_eq!(get_the_cell(&g), CellValue::Blank);
        g.set_cell_value(sheet_id, pos, String::from("a"), None);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        g.set_cell_value(sheet_id, pos, String::from("b"), None);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert!(g.undo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert!(g.redo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert!(g.undo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert!(g.undo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.undo(None).is_none());
        assert_eq!(get_the_cell(&g), CellValue::Blank);
        assert!(g.redo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("a")));
        assert!(g.redo(None) == expected_summary);
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
        assert!(g.redo(None).is_none());
        assert_eq!(get_the_cell(&g), CellValue::Text(String::from("b")));
    }

    #[test]
    fn test_unpack_currency() {
        let value = String::from("$123.123");
        assert_eq!(
            GridController::unpack_currency(&value),
            Some((String::from("$"), BigDecimal::from_str(&"123.123").unwrap()))
        );

        let value = String::from("test");
        assert_eq!(GridController::unpack_currency(&value), None);

        let value = String::from("$123$123");
        assert_eq!(GridController::unpack_currency(&value), None);

        let value = String::from("$123.123abc");
        assert_eq!(GridController::unpack_currency(&value), None);
    }

    #[test]
    fn test_unpack_percentage() {
        let value = String::from("1238.12232%");
        assert_eq!(
            GridController::unpack_percentage(&value),
            Some(BigDecimal::from_str(&"12.3812232").unwrap()),
        );
    }
}
