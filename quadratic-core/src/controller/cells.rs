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
    fn is_currency(value: &CellValue) -> Option<(String, f64)> {
        if value.type_name() != "text" {
            return None;
        }
        let s = value.to_string();
        if s.len() == 0 {
            return None;
        }
        let possible_currency = s.chars().next().unwrap();
        if CURRENCY_SYMBOLS.contains(possible_currency) {
            let split: Vec<&str> = s.split(possible_currency).collect();
            if split.len() == 2 {
                if let Ok(number) = split[1].parse::<f64>() {
                    return Some((possible_currency.to_string(), number));
                }
            }
        }
        None
    }

    /// sets the value based on a user's input
    pub fn set_cell_value(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        value: CellValue,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let sheet = self.grid.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        let region = RegionRef::from(cell_ref);
        let mut ops = vec![];
        if let Some((currency, number)) = Self::is_currency(&value) {
            ops.push(Operation::SetCellValues {
                region: region.clone(),
                values: Array::from(CellValue::Number(number)),
            });
            let numeric_format =
                NumericFormat::new(NumericFormatKind::Currency, Some(2), Some(currency));
            ops.push(Operation::SetCellFormats {
                region,
                attr: CellFmtArray::NumericFormat(RunLengthEncoding::repeat(
                    Some(numeric_format),
                    1,
                )),
            })
        } else {
            let values = Array::from(value);
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
    g.set_cell_value(sheet_id, pos, "a".into(), None);
    assert_eq!(get_the_cell(&g), "a".into());
    g.set_cell_value(sheet_id, pos, "b".into(), None);
    assert_eq!(get_the_cell(&g), "b".into());
    assert!(g.undo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "a".into());
    assert!(g.redo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "b".into());
    assert!(g.undo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "a".into());
    assert!(g.undo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), CellValue::Blank);
    assert!(g.undo(None).is_none());
    assert_eq!(get_the_cell(&g), CellValue::Blank);
    assert!(g.redo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "a".into());
    assert!(g.redo(None) == expected_summary);
    assert_eq!(get_the_cell(&g), "b".into());
    assert!(g.redo(None).is_none());
    assert_eq!(get_the_cell(&g), "b".into());
}

#[test]
fn test_is_currency() {
    let value = CellValue::Text(String::from("$123.123"));
    assert_eq!(
        GridController::is_currency(&value),
        Some((String::from("$"), 123.123))
    );

    let value = CellValue::Text(String::from("test"));
    assert_eq!(GridController::is_currency(&value), None);

    let value = CellValue::Text(String::from("$123$123"));
    assert_eq!(GridController::is_currency(&value), None);

    let value = CellValue::Text(String::from("$123.123abc"));
    assert_eq!(GridController::is_currency(&value), None);
}
