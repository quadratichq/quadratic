use std::collections::{btree_map, BTreeMap, HashSet};
use std::str::FromStr;

use bigdecimal::{BigDecimal, RoundingMode};
use borders::Borders;
use indexmap::IndexMap;
use rand::Rng;
use serde::{Deserialize, Serialize};
use validations::Validations;

use super::bounds::GridBounds;
use super::column::Column;
use super::ids::SheetId;
use super::js_types::{CellFormatSummary, CellType, JsCellValue, JsCellValuePos};
use super::resize::ResizeMap;
use super::{CellWrap, CodeRun, NumericFormatKind, SheetFormatting};
use crate::sheet_offsets::SheetOffsets;
use crate::{A1Selection, Array, CellValue, Pos, Rect};

pub mod a1_selection;
pub mod borders;
pub mod bounds;
pub mod cell_array;
pub mod cell_values;
pub mod clipboard;
pub mod code;
pub mod col_row;
pub mod formats;
pub mod jump_cursor;
pub mod rendering;
pub mod rendering_date_time;
pub mod row_resize;
pub mod search;
pub mod send_render;
pub mod sheet_test;
pub mod summarize;
pub mod validations;

/// Sheet in a file.
///
/// Internal invariants (not an exhaustive list):
/// - `infinite_sheet_format`, `infinite_column_formats`,
///   `infinite_row_formats`, and formatting in stored in `columns` must never
///   overlap
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Sheet {
    pub id: SheetId,
    pub name: String,
    pub color: Option<String>,
    pub order: String,

    pub offsets: SheetOffsets,

    /// Cell values, stored by column.
    #[serde(with = "crate::util::btreemap_serde")]
    pub columns: BTreeMap<i64, Column>,

    #[serde(with = "crate::util::indexmap_serde")]
    pub code_runs: IndexMap<Pos, CodeRun>,

    /// Formatting for the entire sheet.
    pub formats: SheetFormatting,

    #[serde(default)]
    pub validations: Validations,

    // bounds for the grid with only data
    pub(super) data_bounds: GridBounds,

    // bounds for the grid with only formatting
    pub(super) format_bounds: GridBounds,

    pub(super) rows_resize: ResizeMap,

    pub borders: Borders,
}
impl Sheet {
    /// Constructs a new empty sheet.
    pub fn new(id: SheetId, name: String, order: String) -> Self {
        Sheet {
            id,
            name,
            color: None,
            order,
            offsets: SheetOffsets::default(),
            columns: BTreeMap::new(),
            code_runs: IndexMap::new(),
            formats: SheetFormatting::default(),
            data_bounds: GridBounds::Empty,
            format_bounds: GridBounds::Empty,
            validations: Validations::default(),
            rows_resize: ResizeMap::default(),
            borders: Borders::default(),
        }
    }

    /// Creates a sheet for testing.
    pub fn test() -> Self {
        Sheet::new(SheetId::TEST, String::from("Sheet 1"), String::from("a0"))
    }

    /// Populates the current sheet with random values
    /// Should only be used for testing (as it will not propagate in multiplayer)
    pub fn random_numbers(&mut self, rect: &Rect) {
        self.columns.clear();
        let mut rng = rand::thread_rng();
        for x in rect.x_range() {
            for y in rect.y_range() {
                let column = self.get_or_create_column(x);
                let value = rng.gen_range(-10000..=10000).to_string();
                column
                    .values
                    .insert(y, CellValue::Number(BigDecimal::from_str(&value).unwrap()));
            }
        }
        self.recalculate_bounds();
    }

    /// Sets a cell value and returns the old cell value. Returns `None` if the cell was deleted
    /// and did not previously exist (so no change is needed).
    pub fn set_cell_value(&mut self, pos: Pos, value: impl Into<CellValue>) -> Option<CellValue> {
        let value = value.into();
        let is_empty = value.is_blank_or_empty_string();
        let value: Option<CellValue> = if is_empty { None } else { Some(value) };

        // if there's no value and the column doesn't exist, then nothing more needs to be done
        if value.is_none() && !self.columns.contains_key(&pos.x) {
            return None;
        }
        let column = self.get_or_create_column(pos.x);
        if let Some(value) = value {
            column.values.insert(pos.y, value)
        } else {
            column.values.remove(&pos.y)
        }
    }

    /// Deletes all cell values in a region. This does not affect:
    ///
    /// - Formatting
    /// - Spilled cells (unless the source is within `region`)
    pub fn delete_cell_values(&mut self, rect: Rect) -> Array {
        let mut old_cell_values_array = Array::new_empty(rect.size());

        for x in rect.x_range() {
            let Some(column) = self.columns.get_mut(&x) else {
                continue;
            };
            let filtered = column
                .values
                .range(rect.y_range())
                .map(|(y, _)| *y)
                .collect::<Vec<_>>();
            let removed = filtered
                .iter()
                .map(|y| (*y, column.values.remove(y)))
                .collect::<Vec<_>>();
            for cell in removed {
                let array_x = (x - rect.min.x) as u32;
                let array_y = (cell.0 - rect.min.y) as u32;
                if let Some(cell_value) = cell.1 {
                    old_cell_values_array
                        .set(array_x, array_y, cell_value)
                        .expect("error inserting value into array of old cell values");
                }
            }
        }

        // remove code_cells where the rect overlaps the anchor cell
        self.code_runs.retain(|pos, _| !rect.contains(*pos));

        old_cell_values_array
    }

    pub fn iter_columns(&self) -> impl Iterator<Item = (&i64, &Column)> {
        self.columns.iter()
    }

    /// Returns true if the cell at Pos has content (ie, not blank). Also checks
    /// tables. Ignores Blanks.
    pub fn has_content(&self, pos: Pos) -> bool {
        if self
            .get_column(pos.x)
            .and_then(|column| column.values.get(&pos.y))
            .is_some_and(|cell_value| !cell_value.is_blank_or_empty_string())
        {
            return true;
        }
        self.has_table_content(pos)
    }

    /// Returns the cell_value at a Pos using both column.values and code_runs (i.e., what would be returned if code asked
    /// for it).
    pub fn display_value(&self, pos: Pos) -> Option<CellValue> {
        let cell_value = self
            .get_column(pos.x)
            .and_then(|column| column.values.get(&pos.y));

        // if CellValue::Code, then we need to get the value from code_runs
        if let Some(cell_value) = cell_value {
            match cell_value {
                CellValue::Code(_) => self
                    .code_runs
                    .get(&pos)
                    .and_then(|run| run.cell_value_at(0, 0)),
                CellValue::Blank => self.get_code_cell_value(pos),
                _ => Some(cell_value.clone()),
            }
        } else {
            // if there is no CellValue at Pos, then we still need to check code_runs
            self.get_code_cell_value(pos)
        }
    }

    /// Returns the JsCellValue at a position
    pub fn js_cell_value(&self, pos: Pos) -> Option<JsCellValue> {
        self.display_value(pos).map(|value| JsCellValue {
            value: value.to_string(),
            kind: value.type_name().to_string(),
        })
    }

    /// Returns the JsCellValuePos at a position
    pub fn js_cell_value_pos(&self, pos: Pos) -> Option<JsCellValuePos> {
        self.display_value(pos).map(|cell_value| match cell_value {
            CellValue::Image(_) => {
                CellValue::Image("Javascript chart".into()).to_cell_value_pos(pos)
            }
            CellValue::Html(_) => CellValue::Html("Python chart".into()).to_cell_value_pos(pos),
            _ => cell_value.to_cell_value_pos(pos),
        })
    }

    /// Returns the JsCellValuePos in a rect
    pub fn get_js_cell_value_pos_in_rect(
        &self,
        rect: Rect,
        max_rows: Option<u32>,
    ) -> Vec<Vec<JsCellValuePos>> {
        let mut rect_values = Vec::new();
        for y in rect
            .y_range()
            .take(max_rows.unwrap_or(rect.height()) as usize)
        {
            let mut row_values = Vec::new();
            for x in rect.x_range() {
                if let Some(cell_value_pos) = self.js_cell_value_pos((x, y).into()) {
                    row_values.push(cell_value_pos);
                }
            }
            if !row_values.is_empty() {
                rect_values.push(row_values);
            }
        }
        rect_values
    }

    /// Returns the cell_value at the Pos in column.values. This does not check or return results within code_runs.
    pub fn cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        column.values.get(&pos.y).cloned()
    }

    pub fn cell_value_ref(&self, pos: Pos) -> Option<&CellValue> {
        let column = self.get_column(pos.x)?;
        column.values.get(&pos.y)
    }

    /// Returns the cell value at a position using both `column.values` and
    /// `code_runs`, for use when a formula references a cell.
    pub fn get_cell_for_formula(&self, pos: Pos) -> CellValue {
        let cell_value = self
            .get_column(pos.x)
            .and_then(|column| column.values.get(&pos.y));

        if let Some(cell_value) = cell_value {
            match cell_value {
                CellValue::Blank | CellValue::Code(_) => match self.code_runs.get(&pos) {
                    Some(run) => run.get_cell_for_formula(0, 0),
                    None => CellValue::Blank,
                },
                other => other.clone(),
            }
        } else {
            self.get_code_cell_value(pos).unwrap_or(CellValue::Blank)
        }
    }

    /// Returns the type of number (defaulting to NumericFormatKind::Number) for a cell.
    pub fn cell_numeric_format_kind(&self, pos: Pos) -> NumericFormatKind {
        match self.formats.numeric_format.get(pos) {
            Some(format) => format.kind,
            None => NumericFormatKind::Number,
        }
    }

    /// Returns a summary of formatting in a region.
    pub fn cell_format_summary(&self, pos: Pos) -> CellFormatSummary {
        let format = self.formats.try_format(pos).unwrap_or_default();
        let cell_type = self
            .display_value(pos)
            .and_then(|cell_value| match cell_value {
                CellValue::Date(_) => Some(CellType::Date),
                CellValue::DateTime(_) => Some(CellType::DateTime),
                _ => None,
            });
        CellFormatSummary {
            bold: format.bold,
            italic: format.italic,
            text_color: format.text_color,
            fill_color: format.fill_color,
            commas: format.numeric_commas,
            align: format.align,
            vertical_align: format.vertical_align,
            wrap: format.wrap,
            date_time: format.date_time,
            cell_type,
            underline: format.underline,
            strike_through: format.strike_through,
        }
    }

    // /// Sets a formatting property for a cell.
    // pub fn set_formatting_value<A: CellFmtAttr>(
    //     &mut self,
    //     pos: Pos,
    //     value: Option<A::Value>,
    // ) -> Option<A::Value> {
    //     // TODO(perf): avoid double lookup
    //     let mut cell_format = self.formats.get(pos).cloned().unwrap_or_default();
    //     *A::get_from_format_mut(&mut cell_format) = value;
    //     A::get_from_format(&self.formats.set(pos, Some(cell_format))?).clone()
    // }

    /// Returns a column of a sheet from the column index.
    pub(crate) fn get_column(&self, index: i64) -> Option<&Column> {
        self.columns.get(&index)
    }

    /// Returns a mutable column of a sheet from the column index.
    pub(crate) fn get_column_mut(&mut self, index: i64) -> Option<&mut Column> {
        self.columns.get_mut(&index)
    }

    /// Returns a column of a sheet from its index, or creates a new column at
    /// that index.
    pub(crate) fn get_or_create_column(&mut self, x: i64) -> &mut Column {
        match self.columns.entry(x) {
            btree_map::Entry::Vacant(e) => {
                let column = e.insert(Column::new(x));
                column
            }
            btree_map::Entry::Occupied(e) => {
                let column = e.into_mut();
                column
            }
        }
    }

    /// Deletes all data and formatting in the sheet, effectively recreating it.
    pub fn clear(&mut self) {
        self.columns.clear();
        self.code_runs.clear();
        self.recalculate_bounds();
    }

    pub fn id_to_string(&self) -> String {
        self.id.to_string()
    }

    /// get or calculate decimal places for a cell
    pub fn calculate_decimal_places(&self, pos: Pos, kind: NumericFormatKind) -> Option<i16> {
        // first check if numeric_decimals already exists for this cell
        if let Some(decimals) = self.formats.numeric_decimals.get(pos) {
            return Some(decimals);
        }

        // if currency and percentage, then use the default 2 decimal places
        if kind == NumericFormatKind::Currency || kind == NumericFormatKind::Percentage {
            return Some(2);
        }

        // otherwise check value to see if it has a decimal and use that length
        if let Some(value) = self.display_value(pos) {
            match value {
                CellValue::Number(n) => {
                    if kind == NumericFormatKind::Exponential {
                        return Some(n.to_string().len() as i16 - 1);
                    }

                    let exponent = n.as_bigint_and_exponent().1;
                    let max_decimals = 9;
                    let mut decimals = n
                        .with_scale_round(exponent.min(max_decimals), RoundingMode::HalfUp)
                        .normalized()
                        .as_bigint_and_exponent()
                        .1 as i16;

                    if kind == NumericFormatKind::Percentage {
                        decimals -= 2;
                    }

                    Some(decimals)
                }
                _ => None,
            }
        } else {
            None
        }
    }

    /// Returns true if the cell at Pos has wrap formatting.
    pub fn check_if_wrap_in_cell(&self, pos: Pos) -> bool {
        if self.cell_value(pos).is_none() {
            return false;
        }
        self.formats.wrap.get(pos) == Some(CellWrap::Wrap)
    }

    pub fn check_if_wrap_in_row(&self, y: i64) -> bool {
        self.formats.wrap.any_in_row(y, |wrap| {
            let pos = Pos { x: 1, y };
            self.cell_value(pos).is_some() && *wrap == Some(CellWrap::Wrap)
        })
    }

    pub fn get_rows_with_wrap_in_column(&self, x: i64) -> Vec<i64> {
        let mut rows = vec![];
        if let Some((start, end)) = self.column_bounds(x, true) {
            for y in start..=end {
                if self.cell_value(Pos { x, y }).is_some()
                    && self
                        .formats
                        .wrap
                        .get(Pos { x, y })
                        .is_some_and(|wrap| wrap == CellWrap::Wrap)
                {
                    rows.push(y);
                }
            }
        }
        rows
    }

    pub fn get_rows_with_wrap_in_rect(&self, rect: &Rect, include_blanks: bool) -> Vec<i64> {
        let mut rows = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if (include_blanks || self.cell_value((x, y).into()).is_some())
                    && self
                        .formats
                        .wrap
                        .get((x, y).into())
                        .is_some_and(|wrap| wrap == CellWrap::Wrap)
                {
                    rows.push(y);
                    break;
                }
            }
        }
        rows
    }

    pub fn get_rows_with_wrap_in_selection(
        &self,
        selection: &A1Selection,
        include_blanks: bool,
    ) -> Vec<i64> {
        let mut rows_set = HashSet::<i64>::new();
        selection.ranges.iter().for_each(|range| {
            let rect = self.cell_ref_range_to_rect(*range);
            let rows = self.get_rows_with_wrap_in_rect(&rect, include_blanks);
            rows_set.extend(rows);
        });
        rows_set.into_iter().collect()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
    use serial_test::parallel;

    use super::*;
    use crate::controller::GridController;
    use crate::grid::{CodeCellLanguage, CodeCellValue, NumericFormat};
    use crate::test_util::print_table;
    use crate::{A1Selection, SheetPos, SheetRect};

    fn test_setup(selection: &Rect, vals: &[&str]) -> (GridController, SheetId) {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid().sheets()[0].id;
        let mut count = 0;

        for y in selection.y_range() {
            for x in selection.x_range() {
                let sheet_pos = SheetPos { x, y, sheet_id };
                grid_controller.set_cell_value(sheet_pos, vals[count].to_string(), None);
                count += 1;
            }
        }

        (grid_controller, sheet_id)
    }

    fn test_setup_basic() -> (GridController, SheetId, Rect) {
        let vals = vec!["1", "2", "3", "4", "5", "6", "7", "8"];
        let selected = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let (grid_controller, sheet_id) = test_setup(&selected, &vals);

        (grid_controller, sheet_id, selected)
    }

    // assert decimal places after a set_cell_value
    fn assert_decimal_places_for_number(
        sheet: &mut Sheet,
        x: i64,
        y: i64,
        value: &str,
        kind: NumericFormatKind,
        expected: Option<i16>,
    ) {
        let pos = Pos { x, y };
        let _ = sheet.set_cell_value(pos, CellValue::Number(BigDecimal::from_str(value).unwrap()));
        assert_eq!(sheet.calculate_decimal_places(pos, kind), expected);
    }

    #[test]
    fn test_current_decimal_places_value() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        // validate simple decimal places
        assert_decimal_places_for_number(
            &mut sheet,
            1,
            2,
            "12.23",
            NumericFormatKind::Number,
            Some(2),
        );

        // validate percentage
        assert_decimal_places_for_number(
            &mut sheet,
            2,
            2,
            "0.23",
            NumericFormatKind::Percentage,
            Some(2),
        );

        // validate rounding
        assert_decimal_places_for_number(
            &mut sheet,
            3,
            2,
            "9.1234567891",
            NumericFormatKind::Number,
            Some(9),
        );

        // validate percentage rounding
        assert_decimal_places_for_number(
            &mut sheet,
            3,
            2,
            "9.1234567891",
            NumericFormatKind::Percentage,
            Some(2),
        );

        assert_decimal_places_for_number(
            &mut sheet,
            3,
            2,
            "9.1234567891",
            NumericFormatKind::Currency,
            Some(2),
        );

        assert_decimal_places_for_number(
            &mut sheet,
            3,
            2,
            "91234567891",
            NumericFormatKind::Exponential,
            Some(10),
        );
    }

    #[test]
    fn decimal_places() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .numeric_decimals
            .set_rect(3, 1, Some(3), None, Some(2));
        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 3, y: 3 }, NumericFormatKind::Number),
            Some(2)
        );

        sheet
            .formats
            .numeric_decimals
            .set(Pos { x: 3, y: 3 }, Some(3));
        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 3, y: 3 }, NumericFormatKind::Number),
            Some(3)
        );
        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 3, y: 3 }, NumericFormatKind::Percentage),
            Some(3)
        );
        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 3, y: 3 }, NumericFormatKind::Currency),
            Some(3)
        );
    }

    #[test]
    fn test_current_decimal_places_text() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        let _ = sheet.set_cell_value(
            crate::Pos { x: 1, y: 2 },
            CellValue::Text(String::from("abc")),
        );

        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 1, y: 2 }, NumericFormatKind::Number),
            None
        );
    }

    #[test]
    fn test_current_decimal_places_float() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        sheet.set_cell_value(
            crate::Pos { x: 1, y: 2 },
            CellValue::Number(BigDecimal::from_str("11.100000000000000000").unwrap()),
        );

        // expect a single decimal place
        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 1, y: 2 }, NumericFormatKind::Number),
            Some(1)
        );
    }

    #[test]
    fn test_cell_numeric_format_kind() {
        let mut sheet = Sheet::test();

        sheet.formats.numeric_format.set(
            pos![A1],
            Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }),
        );

        assert_eq!(
            sheet.cell_numeric_format_kind(pos![A1]),
            NumericFormatKind::Percentage
        );
    }

    #[test]
    fn test_set_cell_values() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 4, y: 1 });
        let vals = vec!["a", "1", "$1.11"];
        let expected = [
            CellValue::Text("a".into()),
            CellValue::Number(BigDecimal::from_str("1").unwrap()),
            CellValue::Number(BigDecimal::from_str("1.11").unwrap()),
        ];
        let (grid, sheet_id) = test_setup(&selected, &vals);

        print_table(&grid, sheet_id, selected);

        let sheet = grid.sheet(sheet_id);
        let values = sheet.cell_values_in_rect(&selected, false).unwrap();
        values
            .into_cell_values_vec()
            .into_iter()
            .enumerate()
            .for_each(|(index, val)| assert_eq!(val, *expected.get(index).unwrap()));
    }

    #[test]
    fn delete_cell_values() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "a", "b"]);

        let rect = SheetRect::from_numbers(0, 0, 2, 2, sheet_id);
        let selection = A1Selection::from_rect(rect);
        gc.delete_cells(&selection, None);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.cell_value(Pos { x: 0, y: 0 }).is_none());
        assert!(sheet.cell_value(Pos { x: 0, y: 1 }).is_none());
        assert!(sheet.cell_value(Pos { x: 1, y: 0 }).is_none());
        assert!(sheet.cell_value(Pos { x: 1, y: 1 }).is_none());
    }

    #[test]
    fn delete_cell_values_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(
            Pos { x: 0, y: 0 },
            CellValue::Code(CodeCellValue {
                code: "test".to_string(),
                language: CodeCellLanguage::Formula,
            }),
        );
        gc.delete_cells(&A1Selection::from_xy(0, 0, sheet_id), None);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.cell_value(Pos { x: 0, y: 0 }).is_none());
    }

    // TODO(ddimaria): use the code below as a template once cell borders are in place
    // TODO(jrice): Uncomment and test
    // #[ignore]
    // #[tokio::test]
    // async fn test_set_border() {
    //     let (grid, sheet_id, selected) = test_setup_basic().await;
    //     let cell_border = CellBorder {
    //         color: Some("red".into()),
    //         style: Some(CellBorderStyle::Line1),
    //     };
    //     let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();
    //     sheet.set_horizontal_border(selected, cell_border.clone());
    //     sheet.set_vertical_border(selected, cell_border);
    //     let _borders = sheet.borders();
    //
    //     print_table(&grid, sheet_id, selected);
    //
    //     // let formats = grid.get_all_cell_formats(sheet_id, selected);
    //     // formats
    //     //     .into_iter()
    //     //     .for_each(|format| assert_eq!(format, SOMETHING_HERE));
    // }

    #[test]
    fn test_get_cell_value() {
        let (grid, sheet_id, _) = test_setup_basic();
        let sheet = grid.sheet(sheet_id);
        let value = sheet.display_value((2, 1).into());

        assert_eq!(value, Some(CellValue::Number(BigDecimal::from(1))));
    }

    // #[test]
    // fn test_get_set_formatting_value() {
    //     let (grid, sheet_id, _) = test_setup_basic();
    //     let mut sheet = grid.sheet(sheet_id).clone();
    //     let _ = sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
    //     let bold: Option<bool> = sheet.get_formatting_value::<Bold>((2, 1).into());
    //     assert_eq!(bold, Some(true));

    //     let _ = sheet.set_formatting_value::<Italic>((2, 1).into(), Some(true));
    //     let italic = sheet.get_formatting_value::<Italic>((2, 1).into());
    //     assert_eq!(italic, Some(true));
    // }

    #[test]
    fn cell_format_summary() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.sheet(sheet_id).clone();

        let format_summary = sheet.cell_format_summary((2, 1).into());
        assert_eq!(format_summary, CellFormatSummary::default());

        // just set a bold value
        sheet.formats.bold.set(Pos { x: 2, y: 1 }, Some(true));
        let value = sheet.cell_format_summary((2, 1).into());
        let mut cell_format_summary = CellFormatSummary {
            bold: Some(true),
            ..Default::default()
        };
        assert_eq!(value, cell_format_summary);

        let format_summary = sheet.cell_format_summary((2, 1).into());
        assert_eq!(cell_format_summary.clone(), format_summary);

        // now set a italic value
        sheet.formats.italic.set(Pos { x: 2, y: 1 }, Some(true));
        let value = sheet.cell_format_summary((2, 1).into());
        cell_format_summary.italic = Some(true);
        assert_eq!(value, cell_format_summary);

        let existing_cell_format_summary = sheet.cell_format_summary((2, 1).into());
        assert_eq!(cell_format_summary.clone(), existing_cell_format_summary);

        sheet.set_cell_value(
            Pos { x: 0, y: 0 },
            CellValue::Date(NaiveDate::from_str("2024-12-21").unwrap()),
        );
        let format_summary = sheet.cell_format_summary((0, 0).into());
        assert_eq!(format_summary.cell_type, Some(CellType::Date));

        sheet.set_cell_value(
            Pos { x: 1, y: 0 },
            CellValue::DateTime(
                NaiveDateTime::parse_from_str("2024-12-21 1:23 PM", "%Y-%m-%d %-I:%M %p").unwrap(),
            ),
        );
        let format_summary = sheet.cell_format_summary((1, 0).into());
        assert_eq!(format_summary.cell_type, Some(CellType::DateTime));

        sheet.set_cell_value(
            Pos { x: 2, y: 0 },
            CellValue::Time(NaiveTime::parse_from_str("1:23 pm", "%-I:%M %p").unwrap()),
        );
        let format_summary = sheet.cell_format_summary((2, 0).into());
        assert_eq!(format_summary.cell_type, None);
    }

    #[test]
    fn display_value_blanks() {
        let mut sheet = Sheet::test();
        let pos = pos![A1];
        assert_eq!(sheet.display_value(pos), None);
        sheet.set_cell_value(pos, CellValue::Blank);
        assert_eq!(sheet.display_value(pos), None);
    }

    #[test]
    fn test_check_if_wrap_in_cell() {
        let mut sheet = Sheet::test();
        let pos = pos![A1];
        sheet.set_cell_value(pos, "test");
        assert!(!sheet.check_if_wrap_in_cell(pos));
        sheet.formats.wrap.set(pos, Some(CellWrap::Wrap));
        assert!(sheet.check_if_wrap_in_cell(pos));
        sheet.formats.wrap.set(pos, Some(CellWrap::Overflow));
        assert!(!sheet.check_if_wrap_in_cell(pos));
        sheet.formats.wrap.set(pos, Some(CellWrap::Wrap));
        assert!(sheet.check_if_wrap_in_cell(pos));
        sheet.formats.wrap.set(pos, Some(CellWrap::Clip));
        assert!(!sheet.check_if_wrap_in_cell(pos));
    }

    #[test]
    fn test_check_if_wrap_in_row() {
        let mut sheet = Sheet::test();
        let pos = pos![A1];
        sheet.set_cell_value(pos, "test");
        assert!(!sheet.check_if_wrap_in_row(1));
        sheet.formats.wrap.set(pos, Some(CellWrap::Wrap));
        assert!(sheet.check_if_wrap_in_row(1));
        sheet.formats.wrap.set(pos, Some(CellWrap::Overflow));
        assert!(!sheet.check_if_wrap_in_row(1));
        sheet.formats.wrap.set(pos, Some(CellWrap::Clip));
        assert!(!sheet.check_if_wrap_in_row(1));
    }

    #[test]
    fn test_get_rows_with_wrap_in_column() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(pos![A1], "test");
        sheet.set_cell_value(pos![A3], "test");
        assert_eq!(sheet.get_rows_with_wrap_in_column(1), Vec::<i64>::new());
        sheet
            .formats
            .wrap
            .set_rect(1, 1, Some(1), Some(5), Some(CellWrap::Wrap));
        assert_eq!(sheet.get_rows_with_wrap_in_column(1), vec![1, 3]);
    }

    #[test]
    fn test_get_rows_with_wrap_in_rect() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(pos![A1], "test");
        sheet.set_cell_value(pos![A3], "test");
        let rect = Rect {
            min: pos![A1],
            max: pos![A4],
        };
        assert_eq!(
            sheet.get_rows_with_wrap_in_rect(&rect, false),
            Vec::<i64>::new()
        );
        sheet
            .formats
            .wrap
            .set_rect(1, 1, Some(1), Some(5), Some(CellWrap::Wrap));
        assert_eq!(sheet.get_rows_with_wrap_in_rect(&rect, false), vec![1, 3]);
    }

    #[test]
    fn test_get_rows_with_wrap_in_selection() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(pos![A1], "test");
        sheet.set_cell_value(pos![A3], "test");
        let selection = A1Selection::test_a1("A1:A4");
        assert_eq!(
            sheet.get_rows_with_wrap_in_selection(&selection, false),
            Vec::<i64>::new()
        );
        sheet
            .formats
            .wrap
            .set_rect(1, 1, Some(1), Some(5), Some(CellWrap::Wrap));
        let mut rows = sheet.get_rows_with_wrap_in_selection(&selection, false);
        rows.sort();
        assert_eq!(rows, vec![1, 3]);
    }

    #[test]
    fn js_cell_value() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, "test");
        let js_cell_value = sheet.js_cell_value(Pos { x: 0, y: 0 });
        assert_eq!(
            js_cell_value,
            Some(JsCellValue {
                value: "test".to_string(),
                kind: "text".to_string()
            })
        );
    }

    #[test]
    #[parallel]
    fn js_cell_value_pos() {
        let mut sheet = Sheet::test();
        let pos = pos![A1];
        sheet.set_cell_value(pos, "test");
        let js_cell_value_pos = sheet.js_cell_value_pos(pos);
        assert_eq!(
            js_cell_value_pos,
            Some(JsCellValuePos {
                value: "test".to_string(),
                kind: "text".to_string(),
                pos: pos.a1_string(),
            })
        );

        let pos = pos![B2];
        sheet.set_cell_value(pos, CellValue::Image("image string".to_string()));
        let js_cell_value_pos = sheet.js_cell_value_pos(pos);
        assert_eq!(
            js_cell_value_pos,
            Some(JsCellValuePos {
                value: "Javascript chart".to_string(),
                kind: "image".to_string(),
                pos: pos.a1_string(),
            })
        );

        let pos = pos![C3];
        sheet.set_cell_value(pos, CellValue::Html("html string".to_string()));
        let js_cell_value_pos = sheet.js_cell_value_pos(pos);
        assert_eq!(
            js_cell_value_pos,
            Some(JsCellValuePos {
                value: "Python chart".to_string(),
                kind: "html".to_string(),
                pos: pos.a1_string(),
            })
        );
    }

    #[test]
    #[parallel]
    fn get_js_cell_value_pos_in_rect() {
        let mut sheet = Sheet::test();
        sheet.set_cell_values(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 10, y: 1000 },
            },
            &Array::from(
                (1..=1000)
                    .map(|row| {
                        (1..=10)
                            .map(|_| {
                                if row == 1 {
                                    "heading".to_string()
                                } else {
                                    "value".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        let max_rows = 3;

        let js_cell_value_pos_in_rect = sheet.get_js_cell_value_pos_in_rect(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 10, y: 1000 },
            },
            Some(max_rows),
        );

        assert_eq!(js_cell_value_pos_in_rect.len(), max_rows as usize);

        let expected_js_cell_value_pos_in_rect: Vec<Vec<JsCellValuePos>> = (1..=max_rows)
            .map(|row| {
                (1..=10)
                    .map(|col| {
                        if row == 1 {
                            JsCellValuePos {
                                value: "heading".to_string(),
                                kind: "text".to_string(),
                                pos: Pos {
                                    x: col,
                                    y: row as i64,
                                }
                                .a1_string(),
                            }
                        } else {
                            JsCellValuePos {
                                value: "value".to_string(),
                                kind: "text".to_string(),
                                pos: Pos {
                                    x: col,
                                    y: row as i64,
                                }
                                .a1_string(),
                            }
                        }
                    })
                    .collect::<Vec<JsCellValuePos>>()
            })
            .collect::<Vec<Vec<JsCellValuePos>>>();

        assert_eq!(
            js_cell_value_pos_in_rect,
            expected_js_cell_value_pos_in_rect
        );
    }
}
