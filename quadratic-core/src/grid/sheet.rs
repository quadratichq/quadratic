use std::collections::{btree_map, BTreeMap, HashSet};
use std::str::FromStr;

use bigdecimal::{BigDecimal, RoundingMode};
use borders_new::Borders;
use indexmap::IndexMap;
use rand::Rng;
use serde::{Deserialize, Serialize};
use validations::Validations;

use super::bounds::GridBounds;
use super::column::Column;
use super::formats::format::Format;
use super::formatting::CellFmtAttr;
use super::ids::SheetId;
use super::js_types::{CellFormatSummary, CellType, JsCellValue};
use super::resize::ResizeMap;
use super::{CellWrap, CodeRun, NumericFormatKind};
use crate::grid::{borders, SheetBorders};
use crate::selection::Selection;
use crate::sheet_offsets::SheetOffsets;
use crate::{Array, CellValue, Pos, Rect};

pub mod borders_new;
pub mod bounds;
pub mod cell_array;
pub mod cell_values;
pub mod clipboard;
pub mod code;
pub mod formats;
pub mod formatting;
pub mod rendering;
pub mod rendering_date_time;
pub mod row_resize;
pub mod search;
pub mod selection;
pub mod send_render;
pub mod sheet_test;
pub mod summarize;
pub mod validations;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Sheet {
    pub id: SheetId,
    pub name: String,
    pub color: Option<String>,
    pub order: String,

    pub offsets: SheetOffsets,

    #[serde(with = "crate::util::btreemap_serde")]
    pub columns: BTreeMap<i64, Column>,
    pub borders: SheetBorders,

    #[serde(with = "crate::util::indexmap_serde")]
    pub code_runs: IndexMap<Pos, CodeRun>,

    // todo: we need to redo this struct to track the timestamp for all formats
    // applied to column and rows to properly use the latest column or row
    // formatting. The current implementation only stores the latest format for
    // fill color (which I mistakenly thought would be the only conflict). This
    // regrettably requires a change to the file format since it will break
    // existing use cases.

    // Column/Row, and All formatting. The second tuple stores the timestamp for
    // the fill_color, which is used to determine the z-order for overlapping
    // column and row fills.
    #[serde(
        skip_serializing_if = "BTreeMap::is_empty",
        with = "crate::util::btreemap_serde"
    )]
    pub formats_columns: BTreeMap<i64, (Format, i64)>,
    #[serde(
        skip_serializing_if = "BTreeMap::is_empty",
        with = "crate::util::btreemap_serde"
    )]
    pub formats_rows: BTreeMap<i64, (Format, i64)>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_all: Option<Format>,

    #[serde(default)]
    pub validations: Validations,

    // bounds for the grid with only data
    pub(super) data_bounds: GridBounds,

    // bounds for the gird with only formatting
    pub(super) format_bounds: GridBounds,

    pub(super) rows_resize: ResizeMap,

    pub borders_new: Borders,
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
            borders: SheetBorders::new(),

            code_runs: IndexMap::new(),

            formats_columns: BTreeMap::new(),
            formats_rows: BTreeMap::new(),
            format_all: None,

            data_bounds: GridBounds::Empty,

            format_bounds: GridBounds::Empty,

            validations: Validations::default(),
            rows_resize: ResizeMap::default(),

            borders_new: Borders::default(),
        }
    }

    // creates a Sheet for testing
    #[cfg(test)]
    pub fn test() -> Self {
        Sheet::new(SheetId::test(), String::from("name"), String::from("A0"))
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

    /// Sets or deletes borders in a region.
    pub fn set_region_borders(&mut self, rect: &Rect, borders: SheetBorders) -> SheetBorders {
        borders::set_rect_borders(self, rect, borders)
    }

    /// Gets borders in a region.
    pub fn get_rect_borders(&self, rect: Rect) -> SheetBorders {
        borders::get_rect_borders(self, &rect)
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

    /// Returns a formatting property of a cell.
    pub fn get_formatting_value<A: CellFmtAttr>(&self, pos: Pos) -> Option<A::Value> {
        let column = self.get_column(pos.x)?;
        A::column_data_ref(column).get(pos.y)
    }

    /// Returns the type of number (defaulting to NumericFormatKind::Number) for a cell.
    pub fn cell_numeric_format_kind(&self, pos: Pos) -> NumericFormatKind {
        if let Some(column) = self.get_column(pos.x) {
            if let Some(format) = column.numeric_format.get(pos.y) {
                return format.kind;
            }
        }
        NumericFormatKind::Number
    }

    /// Returns a summary of formatting in a region.
    pub fn cell_format_summary(&self, pos: Pos, include_sheet_info: bool) -> CellFormatSummary {
        let cell = self.columns.get(&pos.x).map(|column| Format {
            bold: column.bold.get(pos.y),
            italic: column.italic.get(pos.y),
            text_color: column.text_color.get(pos.y),
            fill_color: column.fill_color.get(pos.y),
            numeric_commas: column.numeric_commas.get(pos.y),
            align: column.align.get(pos.y),
            vertical_align: column.vertical_align.get(pos.y),
            wrap: column.wrap.get(pos.y),
            date_time: column.date_time.get(pos.y),
            ..Default::default()
        });
        let cell_type = self
            .display_value(pos)
            .and_then(|cell_value| match cell_value {
                CellValue::Date(_) => Some(CellType::Date),
                CellValue::DateTime(_) => Some(CellType::DateTime),
                _ => None,
            });
        let format = if include_sheet_info {
            Format::combine(
                cell.as_ref(),
                self.try_format_column(pos.x).as_ref(),
                self.try_format_row(pos.y).as_ref(),
                self.format_all.as_ref(),
            )
        } else {
            cell.unwrap_or_default()
        };
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
        }
    }

    /// Sets a formatting property for a cell.
    pub fn set_formatting_value<A: CellFmtAttr>(
        &mut self,
        pos: Pos,
        value: Option<A::Value>,
    ) -> Option<A::Value> {
        let column = self.get_or_create_column(pos.x);
        A::column_data_mut(column).set(pos.y, value)
    }

    /// Returns all cell borders.
    pub fn borders(&self) -> &SheetBorders {
        &self.borders
    }

    /// Returns all cell borders.
    pub fn mut_borders(&mut self) -> &mut SheetBorders {
        &mut self.borders
    }

    /// Returns a column of a sheet from the column index.
    pub(crate) fn get_column(&self, index: i64) -> Option<&Column> {
        self.columns.get(&index)
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
        if let Some(decimals) = self.format_cell(pos.x, pos.y, true).numeric_decimals {
            return Some(decimals);
        }

        // if currency, then use the default 2 decimal places
        if kind == NumericFormatKind::Currency {
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

    pub fn check_if_wrap_in_cell(&self, x: i64, y: i64) -> bool {
        let value: Option<CellValue> = self.cell_value(Pos { x, y });
        let format = self.format_cell(x, y, true);
        value.is_some() && Some(CellWrap::Wrap) == format.wrap
    }

    pub fn check_if_wrap_in_row(&self, y: i64) -> bool {
        if let Some((min, max)) = self.row_bounds(y, true) {
            for x in min..=max {
                let value: Option<CellValue> = self.cell_value(Pos { x, y });
                let format = self.format_cell(x, y, true);
                if value.is_some() && Some(CellWrap::Wrap) == format.wrap {
                    return true;
                }
            }
        }
        false
    }

    pub fn get_rows_with_wrap_in_column(&self, x: i64) -> Vec<i64> {
        let mut rows = vec![];
        if let Some((start, end)) = self.column_bounds(x, true) {
            for y in start..=end {
                let value: Option<CellValue> = self.cell_value(Pos { x, y });
                let format = self.format_cell(x, y, true);
                if value.is_some() && Some(CellWrap::Wrap) == format.wrap {
                    rows.push(y);
                }
            }
        }
        rows
    }

    pub fn get_rows_with_wrap_in_rect(&self, rect: &Rect) -> Vec<i64> {
        let mut rows = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                let value: Option<CellValue> = self.cell_value(Pos { x, y });
                let format = self.format_cell(x, y, true);
                if value.is_some() && Some(CellWrap::Wrap) == format.wrap {
                    rows.push(y);
                    break;
                }
            }
        }
        rows
    }

    pub fn get_rows_with_wrap_in_selection(&self, selection: &Selection) -> Vec<i64> {
        let mut rows_set = HashSet::<i64>::new();
        if selection.all {
            let bounds = self.bounds(true);
            if let GridBounds::NonEmpty(rect) = bounds {
                let rows = self.get_rows_with_wrap_in_rect(&rect);
                rows_set.extend(rows);
            }
        } else {
            if let Some(columns) = &selection.columns {
                for x in columns {
                    let rows = self.get_rows_with_wrap_in_column(*x);
                    rows_set.extend(rows);
                }
            }
            if let Some(selection_rows) = &selection.rows {
                for row in selection_rows {
                    if self.check_if_wrap_in_row(*row) {
                        rows_set.insert(*row);
                    }
                }
            }
            if let Some(selection_rects) = &selection.rects {
                selection_rects.iter().for_each(|rect| {
                    let rows = self.get_rows_with_wrap_in_rect(rect);
                    rows_set.extend(rows);
                });
            }
        }
        rows_set.into_iter().collect()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{
            formats::{format_update::FormatUpdate, Formats},
            Bold, CodeCellLanguage, Italic, NumericFormat,
        },
        selection::Selection,
        test_util::print_table,
        CodeCellValue, SheetPos,
    };
    use bigdecimal::BigDecimal;
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
    use serial_test::parallel;
    use std::str::FromStr;

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
    #[parallel]
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
            Some(0),
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
            Some(7),
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
    #[parallel]
    fn decimal_places() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_formats_columns(
            &[3],
            &Formats::repeat(
                FormatUpdate {
                    numeric_decimals: Some(Some(2)),
                    ..Default::default()
                },
                1,
            ),
        );
        assert_eq!(
            sheet.calculate_decimal_places(Pos { x: 3, y: 3 }, NumericFormatKind::Number),
            Some(2)
        );

        sheet.set_format_cell(
            Pos { x: 3, y: 3 },
            &FormatUpdate {
                numeric_decimals: Some(Some(3)),
                ..Default::default()
            },
            false,
        );
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
    #[parallel]
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
    #[parallel]
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
    #[parallel]
    fn test_cell_numeric_format_kind() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));
        let column = sheet.get_or_create_column(0);
        column.numeric_format.set(
            0,
            Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }),
        );

        assert_eq!(
            sheet.cell_numeric_format_kind(Pos { x: 0, y: 0 }),
            NumericFormatKind::Percentage
        );
    }

    #[test]
    #[parallel]
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
    #[parallel]
    fn delete_cell_values() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_values(0, 0, 2, 2, vec!["1", "2", "a", "b"]);

        let rect = Rect::from_numbers(0, 0, 2, 2);
        let selection = &Selection::rect(rect, sheet_id);
        gc.delete_cells(selection, None);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.cell_value(Pos { x: 0, y: 0 }).is_none());
        assert!(sheet.cell_value(Pos { x: 0, y: 1 }).is_none());
        assert!(sheet.cell_value(Pos { x: 1, y: 0 }).is_none());
        assert!(sheet.cell_value(Pos { x: 1, y: 1 }).is_none());
    }

    #[test]
    #[parallel]
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
        gc.delete_cells(&Selection::pos(0, 0, sheet_id), None);

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
    #[parallel]
    fn test_get_cell_value() {
        let (grid, sheet_id, _) = test_setup_basic();
        let sheet = grid.sheet(sheet_id);
        let value = sheet.display_value((2, 1).into());

        assert_eq!(value, Some(CellValue::Number(BigDecimal::from(1))));
    }

    #[test]
    #[parallel]
    fn test_get_set_formatting_value() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.sheet(sheet_id).clone();
        let _ = sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
        let bold: Option<bool> = sheet.get_formatting_value::<Bold>((2, 1).into());
        assert_eq!(bold, Some(true));

        let _ = sheet.set_formatting_value::<Italic>((2, 1).into(), Some(true));
        let italic = sheet.get_formatting_value::<Italic>((2, 1).into());
        assert_eq!(italic, Some(true));
    }

    #[test]
    #[parallel]
    fn cell_format_summary() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.sheet(sheet_id).clone();

        let format_summary = sheet.cell_format_summary((2, 1).into(), false);
        assert_eq!(format_summary, CellFormatSummary::default());

        // just set a bold value
        let _ = sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
        let value = sheet.cell_format_summary((2, 1).into(), false);
        let mut cell_format_summary = CellFormatSummary {
            bold: Some(true),
            ..Default::default()
        };
        assert_eq!(value, cell_format_summary);

        let format_summary = sheet.cell_format_summary((2, 1).into(), false);
        assert_eq!(cell_format_summary.clone(), format_summary);

        // now set a italic value
        let _ = sheet.set_formatting_value::<Italic>((2, 1).into(), Some(true));
        let value = sheet.cell_format_summary((2, 1).into(), false);
        cell_format_summary.italic = Some(true);
        assert_eq!(value, cell_format_summary);

        let existing_cell_format_summary = sheet.cell_format_summary((2, 1).into(), false);
        assert_eq!(cell_format_summary.clone(), existing_cell_format_summary);

        sheet.set_cell_value(
            Pos { x: 0, y: 0 },
            CellValue::Date(NaiveDate::from_str("2024-12-21").unwrap()),
        );
        let format_summary = sheet.cell_format_summary((0, 0).into(), false);
        assert_eq!(format_summary.cell_type, Some(CellType::Date));

        sheet.set_cell_value(
            Pos { x: 1, y: 0 },
            CellValue::DateTime(
                NaiveDateTime::parse_from_str("2024-12-21 1:23 PM", "%Y-%m-%d %-I:%M %p").unwrap(),
            ),
        );
        let format_summary = sheet.cell_format_summary((1, 0).into(), false);
        assert_eq!(format_summary.cell_type, Some(CellType::DateTime));

        sheet.set_cell_value(
            Pos { x: 2, y: 0 },
            CellValue::Time(NaiveTime::parse_from_str("1:23 pm", "%-I:%M %p").unwrap()),
        );
        let format_summary = sheet.cell_format_summary((2, 0).into(), false);
        assert_eq!(format_summary.cell_type, None);
    }

    #[test]
    #[parallel]
    fn test_columns() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.sheet(sheet_id).clone();

        let column = sheet.get_column(2);
        assert_eq!(None, column.unwrap().bold.get(1));

        // set a bold value, validate it's in the vec
        let _ = sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
        let columns = sheet.iter_columns().collect::<Vec<_>>();
        assert_eq!(Some(true), columns[0].1.bold.get(1));

        // assert that get_column matches the column in the vec
        let index = columns[0].0;
        let column = sheet.get_column(*index);
        assert_eq!(Some(true), column.unwrap().bold.get(1));

        // existing column
        let mut sheet = sheet.clone();
        let existing_column = sheet.get_or_create_column(2);
        assert_eq!(column, Some(existing_column).as_deref());

        // new column
        let mut sheet = sheet.clone();
        let new_column = sheet.get_or_create_column(1);
        assert_eq!(new_column, &Column::new(new_column.x));
    }

    #[test]
    #[parallel]
    fn display_value_blanks() {
        let mut sheet = Sheet::test();
        let pos = Pos { x: 0, y: 0 };
        assert_eq!(sheet.display_value(pos), None);
        sheet.set_cell_value(pos, CellValue::Blank);
        assert_eq!(sheet.display_value(pos), None);
    }

    #[test]
    #[parallel]
    fn test_check_if_wrap_in_cell() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, "test");
        assert!(!sheet.check_if_wrap_in_cell(0, 0));
        let selection = Selection::pos(0, 0, sheet.id);
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(sheet.check_if_wrap_in_cell(0, 0));
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Overflow)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(!sheet.check_if_wrap_in_cell(0, 0));
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(sheet.check_if_wrap_in_cell(0, 0));
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Clip)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(!sheet.check_if_wrap_in_cell(0, 0));
    }

    #[test]
    #[parallel]
    fn test_check_if_wrap_in_row() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, "test");
        assert!(!sheet.check_if_wrap_in_row(0));
        let selection = Selection::pos(0, 0, sheet.id);
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(sheet.check_if_wrap_in_row(0));
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Overflow)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(!sheet.check_if_wrap_in_row(0));
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Clip)),
                    ..FormatUpdate::default()
                },
                1,
            ),
        );
        assert!(!sheet.check_if_wrap_in_row(0));
    }

    #[test]
    #[parallel]
    fn test_get_rows_with_wrap_in_column() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, "test");
        sheet.set_cell_value(Pos { x: 0, y: 2 }, "test");
        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 0, y: 4 },
        };
        assert_eq!(sheet.get_rows_with_wrap_in_column(0), Vec::<i64>::new());
        sheet.set_formats_selection(
            &Selection {
                sheet_id: sheet.id,
                rects: Some(vec![rect]),
                ..Default::default()
            },
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
                4,
            ),
        );
        assert_eq!(sheet.get_rows_with_wrap_in_column(0), vec![0, 2]);
    }

    #[test]
    #[parallel]
    fn test_get_rows_with_wrap_in_rect() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, "test");
        sheet.set_cell_value(Pos { x: 0, y: 2 }, "test");
        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 0, y: 4 },
        };
        assert_eq!(sheet.get_rows_with_wrap_in_rect(&rect), Vec::<i64>::new());
        sheet.set_formats_selection(
            &Selection {
                sheet_id: sheet.id,
                rects: Some(vec![rect]),
                ..Default::default()
            },
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
                4,
            ),
        );
        assert_eq!(sheet.get_rows_with_wrap_in_rect(&rect), vec![0, 2]);
    }

    #[test]
    #[parallel]
    fn test_get_rows_with_wrap_in_selection() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, "test");
        sheet.set_cell_value(Pos { x: 0, y: 2 }, "test");
        let rect = Rect {
            min: Pos { x: 0, y: 0 },
            max: Pos { x: 0, y: 4 },
        };
        let selection = Selection {
            sheet_id: sheet.id,
            rects: Some(vec![rect]),
            ..Default::default()
        };
        assert_eq!(
            sheet.get_rows_with_wrap_in_selection(&selection),
            Vec::<i64>::new()
        );
        sheet.set_formats_selection(
            &selection,
            &Formats::repeat(
                FormatUpdate {
                    wrap: Some(Some(CellWrap::Wrap)),
                    ..FormatUpdate::default()
                },
                4,
            ),
        );
        let mut rows = sheet.get_rows_with_wrap_in_selection(&selection);
        rows.sort();
        assert_eq!(rows, vec![0, 2]);
    }

    #[test]
    #[parallel]
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
}
