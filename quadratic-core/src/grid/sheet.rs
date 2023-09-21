use std::collections::{btree_map, BTreeMap, HashMap};
use std::ops::Range;
use std::str::FromStr;

use bigdecimal::BigDecimal;
use itertools::Itertools;
use rand::Rng;
use serde::{Deserialize, Serialize};

use super::borders::{CellBorder, SheetBorders};
use super::bounds::GridBounds;
use super::code::CodeCellValue;
use super::column::Column;
use super::formatting::{BoolSummary, CellFmtAttr};
use super::ids::{CellRef, ColumnId, IdMap, RegionRef, RowId, SheetId};
use super::js_types::{CellFormatSummary, FormattingSummary};
use super::response::{GetIdResponse, SetCellResponse};
use super::NumericFormatKind;
use crate::{Array, CellValue, IsBlank, Pos, Rect};

pub mod bounds;
pub mod code;
pub mod rendering;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Sheet {
    pub id: SheetId,
    pub name: String,
    pub color: Option<String>,
    pub order: String,

    pub(super) column_ids: IdMap<ColumnId, i64>,
    pub(super) row_ids: IdMap<RowId, i64>,

    #[serde(with = "crate::util::btreemap_serde")]
    pub(super) column_widths: BTreeMap<i64, f32>,
    #[serde(with = "crate::util::btreemap_serde")]
    pub(super) row_heights: BTreeMap<i64, f32>,

    #[serde(with = "crate::util::btreemap_serde")]
    pub(super) columns: BTreeMap<i64, Column>,
    pub(super) borders: SheetBorders,
    #[serde(with = "crate::util::hashmap_serde")]
    pub(super) code_cells: HashMap<CellRef, CodeCellValue>,

    pub(super) data_bounds: GridBounds,
    pub(super) format_bounds: GridBounds,
}
impl Sheet {
    /// Constructs a new empty sheet.
    pub fn new(id: SheetId, name: String, order: String) -> Self {
        Sheet {
            id,
            name,
            color: None,
            order,

            column_ids: IdMap::new(),
            row_ids: IdMap::new(),

            column_widths: BTreeMap::new(),
            row_heights: BTreeMap::new(),

            columns: BTreeMap::new(),
            borders: SheetBorders::new(),
            code_cells: HashMap::new(),

            data_bounds: GridBounds::Empty,
            format_bounds: GridBounds::Empty,
        }
    }

    /// Populates the current sheet with random values
    pub fn with_random_floats(&mut self, region: &Rect) {
        self.columns.clear();
        let mut rng = rand::thread_rng();
        for x in region.x_range() {
            let (_, column) = self.get_or_create_column(x);
            for y in region.y_range() {
                let value = rng.gen_range(-10000..=10000).to_string();
                column.values.set(
                    y,
                    Some(CellValue::Number(BigDecimal::from_str(&value).unwrap())),
                );
            }
        }
        self.recalculate_bounds();
    }

    /// Sets a cell value and returns a response object, which contains column &
    /// row IDs and the old cell value. Returns `None` if the cell was deleted
    /// and did not previously exist (so no change is needed). The reason for
    /// this is that the column and/or row may never have been generated,
    /// because there's no need.
    pub fn set_cell_value(
        &mut self,
        pos: Pos,
        value: CellValue,
    ) -> Option<SetCellResponse<CellValue>> {
        let is_blank = value.is_blank();
        let value: Option<CellValue> = if is_blank { None } else { Some(value) };
        if value.is_none() && !self.columns.contains_key(&pos.x) {
            return None;
        }

        let (column_response, column) = self.get_or_create_column(pos.x);
        let old_value = column.values.set(pos.y, value).unwrap_or_default();

        let unspill = None;
        // if !is_blank {
        //     if let Some(source) = column.spills.get(pos.y) {
        //         self.unspill(source);
        //         unspill = Some(source);
        //     }
        // }

        // TODO: check for new spills, if the cell was deleted
        let spill = None;

        let row_response = self.get_or_create_row(pos.y);
        Some(SetCellResponse {
            column: column_response,
            row: row_response,
            old_value,

            spill,
            unspill,
        })
    }

    /// Deletes all cell values in a region. This does not affect:
    ///
    /// - Formatting
    /// - Spilled cells (unless the source is within `region`)
    pub fn delete_cell_values(&mut self, region: Rect) -> (Vec<ColumnId>, Vec<RowId>, Array) {
        let row_ids = region
            .y_range()
            .filter_map(|y| self.get_row(y))
            .collect_vec();
        let mut column_ids = vec![];

        let mut old_cell_values_array = Array::new_empty(region.size());

        for x in region.x_range() {
            let Some(column) = self.columns.get_mut(&x) else {
                continue;
            };
            column_ids.push(column.id);
            let removed = column.values.remove_range(region.y_range());
            for block in removed {
                for y in block.range() {
                    let array_x = (x - region.min.x) as u32;
                    let array_y = (y - region.min.y) as u32;
                    let Some(value) = block.get(y) else { continue };
                    old_cell_values_array
                        .set(array_x, array_y, value)
                        .expect("error inserting value into array of old cell values");
                }
            }
        }

        for cell_ref in self.iter_code_cells_locations_in_region(region) {
            // TODO: unspill!
            self.code_cells.remove(&cell_ref);
        }

        (column_ids, row_ids, old_cell_values_array)
    }

    /// Sets or deletes horizontal borders in a region.
    pub fn set_horizontal_border(&mut self, region: Rect, value: CellBorder) {
        self.borders.set_horizontal_border(region, value);
    }
    /// Sets or deletes vertical borders in a region.
    pub fn set_vertical_border(&mut self, region: Rect, value: CellBorder) {
        self.borders.set_vertical_border(region, value);
    }

    /// Returns the value of a cell (i.e., what would be returned if code asked
    /// for it).
    pub fn get_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        column.values.get(pos.y)
    }
    /// Returns a formatting property of a cell.
    pub fn get_formatting_value<A: CellFmtAttr>(&self, pos: Pos) -> Option<A::Value> {
        let column = self.get_column(pos.x)?;
        A::column_data_ref(column).get(pos.y)
    }

    pub fn cell_numeric_format_kind(&self, pos: Pos) -> Option<NumericFormatKind> {
        let column = self.get_column(pos.x)?;
        if let Some(format) = column.numeric_format.get(pos.x) {
            Some(format.kind)
        } else {
            None
        }
    }

    /// Returns a summary of formatting in a region.
    pub fn get_formatting_summary(&self, region: Rect) -> FormattingSummary {
        let mut bold = BoolSummary::default();
        let mut italic = BoolSummary::default();

        for x in region.x_range() {
            match self.columns.get(&x) {
                None => {
                    bold.is_any_false = true;
                    italic.is_any_false = true;
                }
                Some(column) => {
                    bold |= column.bold.bool_summary(region.y_range());
                    italic |= column.italic.bool_summary(region.y_range());
                }
            };
        }

        FormattingSummary { bold, italic }
    }

    /// Returns a summary of formatting in a region.
    pub fn get_cell_format_summary(&self, pos: Pos) -> CellFormatSummary {
        match self.columns.get(&pos.x) {
            None => CellFormatSummary {
                bold: None,
                italic: None,
                text_color: None,
                fill_color: None,
            },
            Some(column) => CellFormatSummary {
                bold: column.bold.get(pos.y),
                italic: column.italic.get(pos.y),
                text_color: column.text_color.get(pos.y),
                fill_color: column.fill_color.get(pos.y),
            },
        }
    }

    // returns CellFormatSummary only if a formatting exists
    pub fn get_existing_cell_format(&self, pos: Pos) -> Option<CellFormatSummary> {
        match self.columns.get(&pos.x) {
            Some(column) => {
                let bold = column.bold.get(pos.y);
                let italic = column.italic.get(pos.y);
                let fill_color = column.fill_color.get(pos.y);
                let text_color = column.text_color.get(pos.y);

                if bold.is_some()
                    || italic.is_some()
                    || fill_color.is_some()
                    || text_color.is_some()
                {
                    Some(CellFormatSummary {
                        bold,
                        italic,
                        fill_color,
                        text_color,
                    })
                } else {
                    None
                }
            }
            None => None,
        }
    }

    /// Sets a formatting property for a cell.
    pub fn set_formatting_value<A: CellFmtAttr>(
        &mut self,
        pos: Pos,
        value: Option<A::Value>,
    ) -> Option<A::Value> {
        let (_, column) = self.get_or_create_column(pos.x);
        A::column_data_mut(column).set(pos.y, value)
    }

    /// Returns the widths of columns.
    pub fn column_widths(&self) -> &BTreeMap<i64, f32> {
        &self.column_widths
    }
    /// Returns the heights of rows.
    pub fn row_heights(&self) -> &BTreeMap<i64, f32> {
        &self.row_heights
    }

    /// Returns all cell borders.
    pub fn borders(&self) -> &SheetBorders {
        &self.borders
    }

    /// Returns an iterator over each column and its X coordinate.
    pub fn iter_columns(&self) -> impl '_ + Iterator<Item = (i64, &Column)> {
        self.columns.iter().map(|(&x, column)| (x, column))
    }
    /// Returns an iterator over each row ID and its Y coordinate.
    pub fn iter_rows(&self) -> impl '_ + Iterator<Item = (i64, RowId)> {
        self.row_ids.iter()
    }
    /// Returns a column of a sheet from the column index.
    pub(crate) fn get_column(&self, index: i64) -> Option<&Column> {
        self.columns.get(&index)
    }
    /// Returns a column of a sheet from its index, or creates a new column at
    /// that index.
    pub(crate) fn get_or_create_column(
        &mut self,
        index: i64,
    ) -> (GetIdResponse<ColumnId>, &mut Column) {
        match self.columns.entry(index) {
            btree_map::Entry::Vacant(e) => {
                let column = e.insert(Column::new());
                self.column_ids.add(column.id, index);
                (GetIdResponse::new(column.id), column)
            }
            btree_map::Entry::Occupied(e) => {
                let column = e.into_mut();
                (GetIdResponse::old(column.id), column)
            }
        }
    }
    /// Returns the ID of a row of a sheet from the row index.
    pub(crate) fn get_row(&self, index: i64) -> Option<RowId> {
        self.row_ids.id_at(index)
    }
    /// Returns a row of a sheet from its index, or creates a new row at that
    /// index.
    pub(crate) fn get_or_create_row(&mut self, index: i64) -> GetIdResponse<RowId> {
        match self.row_ids.id_at(index) {
            Some(id) => GetIdResponse::old(id),
            None => {
                let id = RowId::new();
                self.row_ids.add(id, index);
                GetIdResponse::new(id)
            }
        }
    }

    /// Returns the position references by a `CellRef`.
    pub(crate) fn cell_ref_to_pos(&self, cell_ref: CellRef) -> Option<Pos> {
        Some(Pos {
            x: self.column_ids.index_of(cell_ref.column)?,
            y: self.row_ids.index_of(cell_ref.row)?,
        })
    }
    /// Creates a `CellRef` if the column and row already exist.
    pub(crate) fn try_get_cell_ref(&self, pos: Pos) -> Option<CellRef> {
        Some(CellRef {
            sheet: self.id,
            column: self.column_ids.id_at(pos.x)?,
            row: self.row_ids.id_at(pos.y)?,
        })
    }
    /// Creates a `CellRef`, creating the column and row if they do not already
    /// exist.
    pub(crate) fn get_or_create_cell_ref(&mut self, pos: Pos) -> CellRef {
        CellRef {
            sheet: self.id,
            column: self.get_or_create_column(pos.x).0.id,
            row: self.get_or_create_row(pos.y).id,
        }
    }

    /// Returns the X coordinate of a column from its ID, or `None` if no such
    /// column exists.
    pub(crate) fn get_column_index(&self, column_id: ColumnId) -> Option<i64> {
        self.column_ids.index_of(column_id)
    }
    /// Returns the Y coordinate of a row from its ID, or `None` if no such row
    /// exists.
    pub(crate) fn get_row_index(&self, row_id: RowId) -> Option<i64> {
        self.row_ids.index_of(row_id)
    }

    /// Returns contiguous ranges of X coordinates from a list of column IDs.
    /// Ignores IDs for columns that don't exist.
    pub(crate) fn column_ranges(&self, column_ids: &[ColumnId]) -> Vec<Range<i64>> {
        let xs = column_ids
            .iter()
            .filter_map(|&id| self.get_column_index(id));
        contiguous_ranges(xs)
    }
    /// Returns contiguous ranges of Y coordinates from a list of row IDs.
    /// Ignores IDs for rows that don't exist.
    pub(crate) fn row_ranges(&self, row_ids: &[RowId]) -> Vec<Range<i64>> {
        let ys = row_ids.iter().filter_map(|&id| self.get_row_index(id));
        contiguous_ranges(ys)
    }
    /// Returns a list of rectangles that exactly covers a region. Ignores
    /// IDs for columns and rows that don't exist.
    pub(crate) fn region_rects(&self, region: &RegionRef) -> impl Iterator<Item = Rect> {
        let x_ranges = self.column_ranges(&region.columns);
        let y_ranges = self.row_ranges(&region.rows);
        itertools::iproduct!(x_ranges, y_ranges).map(|(xs, ys)| Rect::from_ranges(xs, ys))
    }

    /// Deletes all data and formatting in the sheet, effectively recreating it.
    pub fn clear(&mut self) {
        self.column_ids = IdMap::new();
        self.row_ids = IdMap::new();
        self.columns.clear();
        self.code_cells.clear();
        self.recalculate_bounds();
    }

    pub fn id_to_string(&self) -> String {
        self.id.to_string()
    }

    /// get or calculate decimal places for a cell
    pub fn decimal_places(&self, pos: Pos, is_percentage: bool) -> Option<i16> {
        // first check if numeric_decimals already exists for this cell
        if let Some(decimals) = self.get_column(pos.x)?.numeric_decimals.get(pos.y) {
            return Some(decimals);
        }

        // otherwise check value to see if it has a decimal and use that length
        if let Some(value) = self.get_cell_value(pos) {
            match value {
                CellValue::Number(n) => {
                    let (_, exponent) = n.as_bigint_and_exponent();
                    if is_percentage {
                        Some(exponent as i16 - 2)
                    } else {
                        Some(exponent as i16)
                    }
                }
                _ => None,
            }
        } else {
            None
        }
    }
}

fn contiguous_ranges(values: impl IntoIterator<Item = i64>) -> Vec<Range<i64>> {
    // Usually `values` is already sorted or nearly sorted, in which case this
    // is `O(n)`. At worst, it's `O(n log n)`.
    let mut ret: Vec<Range<i64>> = vec![];
    for i in values.into_iter().sorted() {
        match ret.last_mut() {
            Some(range) if range.end == i => range.end += 1,
            Some(range) if (&*range).contains(&i) => continue,
            _ => ret.push(i..i + 1),
        }
    }
    ret
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use crate::{
        grid::{NumericFormat, NumericFormatKind, Sheet, SheetId},
        CellValue, Pos,
    };

    #[test]
    fn test_current_decimal_places_value() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        // get decimal places after a set_cell_value
        sheet.set_cell_value(
            Pos { x: 1, y: 2 },
            CellValue::Number(BigDecimal::from_str(&"12.23").unwrap()),
        );
        assert_eq!(sheet.decimal_places(Pos { x: 1, y: 2 }, false), Some(2));

        sheet.set_cell_value(
            Pos { x: 2, y: 2 },
            CellValue::Number(BigDecimal::from_str(&"0.23").unwrap()),
        );
        assert_eq!(sheet.decimal_places(Pos { x: 2, y: 2 }, true), Some(0));
    }

    #[test]
    fn test_current_decimal_places_numeric_format() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        let column = sheet.get_or_create_column(3);
        column.1.numeric_decimals.set(3, Some(3));

        assert_eq!(sheet.decimal_places(Pos { x: 3, y: 3 }, false), Some(3));
    }

    #[test]
    fn test_current_decimal_places_text() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        sheet.set_cell_value(
            crate::Pos { x: 1, y: 2 },
            CellValue::Text(String::from("abc")),
        );

        assert_eq!(sheet.decimal_places(Pos { x: 1, y: 2 }, false), None);
    }

    #[test]
    fn test_current_decimal_places_percent() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        sheet.set_cell_value(
            crate::Pos { x: 1, y: 2 },
            CellValue::Number(BigDecimal::from_str(&"0.24").unwrap()),
        );

        assert_eq!(sheet.decimal_places(Pos { x: 1, y: 2 }, true), Some(0));

        sheet.set_cell_value(
            crate::Pos { x: 1, y: 2 },
            CellValue::Number(BigDecimal::from_str(&"0.245").unwrap()),
        );

        assert_eq!(sheet.decimal_places(Pos { x: 1, y: 2 }, true), Some(1));
    }

    #[test]
    fn test_cell_numeric_format_kind() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));
        let column = sheet.get_or_create_column(0);
        column.1.numeric_format.set(
            0,
            Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            }),
        );

        assert_eq!(
            sheet.cell_numeric_format_kind(Pos { x: 0, y: 0 }),
            Some(NumericFormatKind::Percentage)
        );
    }
}
