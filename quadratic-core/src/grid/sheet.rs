use std::collections::{btree_map, BTreeMap, HashMap, HashSet};
use std::ops::Range;
use std::str::FromStr;

use bigdecimal::BigDecimal;
use itertools::Itertools;
use rand::Rng;
use serde::{Deserialize, Serialize};

use super::borders::{CellBorder, SheetBorders};
use super::bounds::GridBounds;
use super::code::{CodeCellRunResult, CodeCellValue};
use super::column::Column;
use super::formatting::{BoolSummary, CellFmtAttr};
use super::ids::{CellRef, ColumnId, IdMap, RegionRef, RowId, SheetId};
use super::js_types::{
    CellFormatSummary, FormattingSummary, JsRenderBorder, JsRenderCell, JsRenderCodeCell,
    JsRenderCodeCellState, JsRenderFill,
};
use super::offsets::Offsets;
use super::response::{GetIdResponse, SetCellResponse};
use super::{NumericFormat, NumericFormatKind};
use crate::{Array, CellValue, IsBlank, Pos, Rect};

pub mod bounds;
pub mod offsets;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Sheet {
    pub id: SheetId,
    pub name: String,
    pub color: Option<String>,
    pub order: String,

    pub(super) column_ids: IdMap<ColumnId, i64>,
    pub(super) row_ids: IdMap<RowId, i64>,

    pub(super) column_widths: Offsets,
    pub(super) row_heights: Offsets,

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

            column_widths: Offsets::new(crate::DEFAULT_COLUMN_WIDTH),
            row_heights: Offsets::new(crate::DEFAULT_ROW_HEIGHT),

            columns: BTreeMap::new(),
            borders: SheetBorders::new(),
            code_cells: HashMap::new(),

            data_bounds: GridBounds::Empty,
            format_bounds: GridBounds::Empty,
        }
    }

    // creates a Sheet for testing
    #[cfg(test)]
    pub fn test() -> Self {
        Sheet::new(SheetId::new(), String::from("name"), String::from("A0"))
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
    /// Sets or deletes a code cell value.
    pub fn set_code_cell_value(&mut self, pos: Pos, code_cell: Option<CodeCellValue>) {
        let cell_ref = self.get_or_create_cell_ref(pos);
        // TODO: unspill!
        self.code_cells.remove(&cell_ref);
        if let Some(code_cell) = code_cell {
            self.code_cells.insert(cell_ref, code_cell);
        }
        // TODO: spill (or have some other way to handle new code results)
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
        // TODO: update to check for code spill cells
    }
    /// Returns a formatting property of a cell.
    pub fn get_formatting_value<A: CellFmtAttr>(&self, pos: Pos) -> Option<A::Value> {
        let column = self.get_column(pos.x)?;
        A::column_data_ref(column).get(pos.y)
    }
    /// Returns a code cell value.
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCellValue> {
        self.code_cells.get(&self.try_get_cell_ref(pos)?)
    }
    /// Returns a code cell value.
    pub fn get_code_cell_from_ref(&self, cell_ref: CellRef) -> Option<&CodeCellValue> {
        self.code_cells.get(&cell_ref)
    }

    pub fn cell_numeric_format_kind(&self, pos: Pos) -> Option<NumericFormatKind> {
        let column = self.get_column(pos.x)?;
        if let Some(format) = column.numeric_format.get(pos.x) {
            Some(format.kind)
        } else {
            None
        }
    }

    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let column = self.get_column(pos.x)?;
        let block = column.spills.get(pos.y)?;
        let code_cell_pos = self.cell_ref_to_pos(block)?;
        let code_cell = self.code_cells.get(&block)?;
        code_cell.get_output_value(
            (pos.x - code_cell_pos.x) as u32,
            (pos.y - code_cell_pos.y) as u32,
        )
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
    // TODL(ddimaria): this function is nearly a duplicate of get_cell_format_summary, talk
    // with the team to see if we can consolidate
    pub fn get_existing_cell_format_summary(&self, pos: Pos) -> Option<CellFormatSummary> {
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

    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    pub fn get_render_cells(&self, region: Rect) -> Vec<JsRenderCell> {
        let columns_iter = region
            .x_range()
            .filter_map(|x| Some((x, self.get_column(x)?)));

        // Fetch ordinary value cells.
        let ordinary_cells = columns_iter.clone().flat_map(|(x, column)| {
            column
                .values
                .values_in_range(region.y_range())
                .map(move |(y, value)| (x, y, column, value, None))
        });

        // Fetch values from code cells.
        let code_output_cells = columns_iter.flat_map(move |(x, column)| {
            column
                .spills
                .blocks_of_range(region.y_range())
                .filter_map(move |block| {
                    let code_cell_pos = self.cell_ref_to_pos(block.content.value)?;
                    let code_cell = self.code_cells.get(&block.content.value)?;
                    let dx = (x - code_cell_pos.x) as u32;
                    let dy = (block.y - code_cell_pos.y) as u32;

                    Some((0..block.len()).filter_map(move |y_within_block| {
                        let y = block.y + y_within_block as i64;
                        let dy = dy + y_within_block as u32;
                        Some((
                            x,
                            y,
                            column,
                            code_cell.get_output_value(dx, dy)?,
                            ((dx, dy) == (0, 0)).then_some(code_cell.language),
                        ))
                    }))
                })
                .flatten()
        });

        itertools::chain(ordinary_cells, code_output_cells)
            .map(|(x, y, column, value, language)| {
                let mut numeric_format: Option<NumericFormat> = None;
                let mut numeric_decimals: Option<i16> = None;

                // only get numeric_format only if it's a CellValue::Number (although it can exist for other types)
                if value.type_name() == "number" {
                    numeric_format = column.numeric_format.get(y);
                    let is_percentage = if let Some(numeric_format) = numeric_format.clone() {
                        numeric_format.kind == NumericFormatKind::Percentage
                    } else {
                        false
                    };
                    numeric_decimals = self.decimal_places(Pos { x, y }, is_percentage);
                }
                JsRenderCell {
                    x,
                    y,

                    value: value.to_display(numeric_format, numeric_decimals),
                    language,

                    align: column.align.get(y),
                    wrap: column.wrap.get(y),
                    bold: column.bold.get(y),
                    italic: column.italic.get(y),
                    text_color: column.text_color.get(y),
                    fill_color: None,
                }
            })
            .collect()
    }

    /// Returns all data for rendering cell fill color.
    pub fn get_all_render_fills(&self) -> Vec<JsRenderFill> {
        let mut ret = vec![];
        for (&x, column) in self.columns.iter() {
            for block in column.fill_color.blocks() {
                ret.push(JsRenderFill {
                    x,
                    y: block.y,
                    w: 1,
                    h: block.len() as u32,
                    color: block.content().value.clone(),
                });
            }
        }
        ret
    }
    /// Returns data for rendering cell fill color.
    pub fn get_render_fills(&self, region: Rect) -> Vec<JsRenderFill> {
        let mut ret = vec![];
        for (&x, column) in self.columns.range(region.x_range()) {
            for block in column.fill_color.blocks_covering_range(region.y_range()) {
                ret.push(JsRenderFill {
                    x,
                    y: block.y,
                    w: 1,
                    h: block.len() as u32,
                    color: block.content().value.clone(),
                });
            }
        }
        ret
    }
    /// Returns data for rendering code cells.
    pub fn get_render_code_cells(&self, region: Rect) -> Vec<JsRenderCodeCell> {
        self.iter_code_cells_locations_in_region(region)
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                if !region.contains(pos) {
                    return None;
                }
                let code_cell = self.code_cells.get(&cell_ref)?;
                let output_size = code_cell.output_size();
                let state = match &code_cell.output {
                    Some(output) => match output.result {
                        CodeCellRunResult::Ok { .. } => JsRenderCodeCellState::Success,
                        CodeCellRunResult::Err { .. } => JsRenderCodeCellState::RunError,
                    },
                    None => JsRenderCodeCellState::NotYetRun,
                };
                Some(JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w: output_size.w.get(),
                    h: output_size.h.get(),
                    language: code_cell.language,
                    state,
                })
            })
            .collect()
    }
    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.iter_code_cells_locations()
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                let code_cell = self.code_cells.get(&cell_ref)?;
                let output_size = code_cell.output_size();
                Some(JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w: output_size.w.get(),
                    h: output_size.h.get(),
                    language: code_cell.language,
                    state: match &code_cell.output {
                        Some(output) => match &output.result {
                            CodeCellRunResult::Ok { .. } => JsRenderCodeCellState::Success,
                            CodeCellRunResult::Err { .. } => JsRenderCodeCellState::RunError,
                        },
                        None => JsRenderCodeCellState::NotYetRun,
                    },
                })
            })
            .collect()
    }
    /// Returns data for rendering horizontal borders.
    pub fn get_render_horizontal_borders(&self) -> Vec<JsRenderBorder> {
        self.borders.get_render_horizontal_borders()
    }
    /// Returns data for rendering vertical borders.
    pub fn get_render_vertical_borders(&self) -> Vec<JsRenderBorder> {
        self.borders.get_render_vertical_borders()
    }

    /// Returns an iterator over all locations containing code cells that may
    /// spill into `region`.
    pub fn iter_code_cells_locations_in_region(
        &self,
        region: Rect,
    ) -> impl Iterator<Item = CellRef> {
        // Scan spilled cells to find code cells. TODO: this won't work for
        // unspilled code cells
        let code_cell_refs: HashSet<CellRef> = self
            .columns
            .range(region.x_range())
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .blocks_covering_range(region.y_range())
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_refs.into_iter()
    }

    pub fn iter_code_cells_locations(&self) -> impl '_ + Iterator<Item = CellRef> {
        self.code_cells.keys().copied()
    }

    // fn unspill(&mut self, source: CellRef) {
    //     todo!("unspill cells from {source:?}");
    // }

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
            Some(range) if (*range).contains(&i) => continue,
            _ => ret.push(i..i + 1),
        }
    }
    ret
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;

    use super::*;
    use crate::{
        controller::{auto_complete::cell_values_in_rect, GridController},
        grid::{Bold, CellBorderStyle, Italic},
        test_util::print_table,
    };

    fn test_setup(selection: &Rect, vals: &[&str]) -> (GridController, SheetId) {
        let mut grid_controller = GridController::new();
        let sheet_id = grid_controller.grid().sheets()[0].id;
        let mut count = 0;

        selection.y_range().for_each(|y| {
            selection.x_range().for_each(|x| {
                let pos = Pos { x, y };
                grid_controller.set_cell_value(sheet_id, pos, vals[count].to_string(), None);
                count += 1;
            });
        });

        (grid_controller, sheet_id)
    }

    fn test_setup_basic() -> (GridController, SheetId, Rect) {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 2 });
        let vals = vec!["1", "2", "3", "4", "5", "6", "7", "8"];
        let (grid_controller, sheet_id) = test_setup(&selected, &vals);

        print_table(&grid_controller, sheet_id, selected);

        (grid_controller, sheet_id, selected)
    }

    #[test]
    fn test_current_decimal_places_value() {
        let mut sheet = Sheet::new(SheetId::new(), String::from(""), String::from(""));

        // get decimal places after a set_cell_value
        sheet.set_cell_value(
            Pos { x: 1, y: 2 },
            CellValue::Number(BigDecimal::from_str("12.23").unwrap()),
        );
        assert_eq!(sheet.decimal_places(Pos { x: 1, y: 2 }, false), Some(2));

        sheet.set_cell_value(
            Pos { x: 2, y: 2 },
            CellValue::Number(BigDecimal::from_str("0.23").unwrap()),
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
            CellValue::Number(BigDecimal::from_str("0.24").unwrap()),
        );

        assert_eq!(sheet.decimal_places(Pos { x: 1, y: 2 }, true), Some(0));

        sheet.set_cell_value(
            crate::Pos { x: 1, y: 2 },
            CellValue::Number(BigDecimal::from_str("0.245").unwrap()),
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

    #[test]
    fn test_set_cell_values() {
        let selected: Rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 4, y: 1 });
        let vals = vec!["a", "1", "$1.11"];
        let expected = vec![
            CellValue::Text("a".into()),
            CellValue::Number(BigDecimal::from_str("1").unwrap()),
            CellValue::Number(BigDecimal::from_str("1.11").unwrap()),
        ];
        let (grid, sheet_id) = test_setup(&selected, &vals);

        print_table(&grid, sheet_id, selected);

        let sheet = grid.grid().sheet_from_id(sheet_id);
        let values = cell_values_in_rect(&selected, &sheet).unwrap();
        values
            .into_cell_values_vec()
            .into_iter()
            .enumerate()
            .for_each(|(index, val)| assert_eq!(val, *expected.get(index).unwrap()));
    }

    #[test]
    fn test_delete_cell_values() {
        let (mut grid, sheet_id, selected) = test_setup_basic();

        grid.delete_cell_values(sheet_id, selected, None);
        let sheet = grid.grid().sheet_from_id(sheet_id);

        print_table(&grid, sheet_id, selected);

        let values = cell_values_in_rect(&selected, &sheet).unwrap();
        values
            .into_cell_values_vec()
            .into_iter()
            .for_each(|v| assert_eq!(v, CellValue::Blank));
    }

    // TODO(ddimaria): use the code below as a template once formula cells are in place
    #[ignore]
    #[test]
    fn test_delete_cell_values_affects_dependent_cells() {
        let (mut grid, sheet_id, selected) = test_setup_basic();

        let view_rect = Rect::new_span(Pos { x: 2, y: 1 }, Pos { x: 5, y: 4 });
        let _code_cell = crate::grid::CodeCellValue {
            language: crate::grid::CodeCellLanguage::Formula,
            code_string: "=SUM(A1:B2)".into(),
            formatted_code_string: None,
            last_modified: "".into(),
            output: None,
        };

        // grid.set_code_cell_value((5, 2).into(), Some(code_cell));
        print_table(&grid, sheet_id, view_rect);

        grid.delete_cell_values(sheet_id, selected, None);
        let sheet = grid.grid().sheet_from_id(sheet_id);

        print_table(&grid, sheet_id, view_rect);

        let values = cell_values_in_rect(&selected, &sheet).unwrap();
        values
            .into_cell_values_vec()
            .into_iter()
            .for_each(|v| assert_eq!(v, CellValue::Blank));
    }

    // TODO(ddimaria): use the code below as a template once cell borders are in place
    #[ignore]
    #[test]
    fn test_set_border() {
        let (grid, sheet_id, selected) = test_setup_basic();
        let cell_border = CellBorder {
            color: Some("red".into()),
            style: Some(CellBorderStyle::Line1),
        };
        let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();
        sheet.set_horizontal_border(selected, cell_border.clone());
        sheet.set_vertical_border(selected, cell_border);
        let _borders = sheet.borders();

        print_table(&grid, sheet_id, selected);

        // let formats = grid.get_all_cell_formats(sheet_id, selected);
        // formats
        //     .into_iter()
        //     .for_each(|format| assert_eq!(format, SOMETHING_HERE));
    }

    #[test]
    fn test_get_cell_value() {
        let (grid, sheet_id, _) = test_setup_basic();
        let sheet = grid.grid().sheet_from_id(sheet_id);
        let value = sheet.get_cell_value((2, 1).into());

        assert_eq!(value, Some(CellValue::Number(BigDecimal::from(1))));
    }

    #[test]
    fn test_get_set_formatting_value() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();
        sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
        let value = sheet.get_formatting_value::<Bold>((2, 1).into());

        assert_eq!(value, Some(true));
    }

    #[test]
    fn test_get_set_code_cell_value() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();
        let code_cell = crate::grid::CodeCellValue {
            language: crate::grid::CodeCellLanguage::Formula,
            code_string: "=SUM(A1:B2)".into(),
            formatted_code_string: None,
            last_modified: "".into(),
            output: None,
        };
        sheet.set_code_cell_value((2, 1).into(), Some(code_cell.clone()));
        let value = sheet.get_code_cell((2, 1).into());

        assert_eq!(value, Some(&code_cell));

        let cell_ref = CellRef {
            sheet: sheet_id,
            column: grid
                .grid()
                .sheet_from_id(sheet_id)
                .column_ids
                .id_at(2)
                .unwrap(),
            row: grid
                .grid()
                .sheet_from_id(sheet_id)
                .row_ids
                .id_at(1)
                .unwrap(),
        };
        let value = sheet.get_code_cell_from_ref(cell_ref);
        assert_eq!(value, Some(&code_cell));
    }

    // TODO(ddimaria): use the code below numeric format kinds are in place
    #[ignore]
    #[test]
    fn test_cell_numeric_format_kinds() {
        let (grid, sheet_id, _) = test_setup_basic();
        let sheet = grid.grid().sheet_from_id(sheet_id).clone();

        let format_kind = sheet.cell_numeric_format_kind((2, 1).into());
        assert_eq!(format_kind, Some(NumericFormatKind::Currency));

        let format_kind = sheet.cell_numeric_format_kind((3, 1).into());
        assert_eq!(format_kind, Some(NumericFormatKind::Percentage));

        let format_kind = sheet.cell_numeric_format_kind((4, 1).into());
        assert_eq!(format_kind, Some(NumericFormatKind::Exponential));

        let format_kind = sheet.cell_numeric_format_kind((5, 1).into());
        assert_eq!(format_kind, Some(NumericFormatKind::Number));
    }

    #[test]
    fn test_formatting_summary() {
        let (grid, sheet_id, selected) = test_setup_basic();
        let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();
        sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));

        // just set a single bold value
        let value = sheet.get_formatting_summary(selected);
        let mut format_summary = FormattingSummary {
            bold: BoolSummary {
                is_any_true: true,
                is_any_false: false,
            },
            italic: BoolSummary {
                is_any_true: false,
                is_any_false: false,
            },
        };
        assert_eq!(value, format_summary);

        // now add in a single italic value
        sheet.set_formatting_value::<Italic>((3, 1).into(), Some(true));
        let value = sheet.get_formatting_summary(selected);
        format_summary.italic.is_any_true = true;
        assert_eq!(value, format_summary);
    }

    #[test]
    fn test_cell_format_summary() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();

        let existing_cell_format_summary = sheet.get_existing_cell_format_summary((2, 1).into());
        assert_eq!(None, existing_cell_format_summary);

        // just set a bold value
        sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
        let value = sheet.get_cell_format_summary((2, 1).into());
        let mut cell_format_summary = CellFormatSummary {
            bold: Some(true),
            italic: None,
            text_color: None,
            fill_color: None,
        };
        assert_eq!(value, cell_format_summary);

        let existing_cell_format_summary = sheet.get_existing_cell_format_summary((2, 1).into());
        assert_eq!(
            Some(cell_format_summary.clone()),
            existing_cell_format_summary
        );

        // now set a italic value
        sheet.set_formatting_value::<Italic>((2, 1).into(), Some(true));
        let value = sheet.get_cell_format_summary((2, 1).into());
        cell_format_summary.italic = Some(true);
        assert_eq!(value, cell_format_summary);

        let existing_cell_format_summary = sheet.get_existing_cell_format_summary((2, 1).into());
        assert_eq!(
            Some(cell_format_summary.clone()),
            existing_cell_format_summary
        );
    }

    #[test]
    fn test_columns() {
        let (grid, sheet_id, _) = test_setup_basic();
        let mut sheet = grid.grid().sheet_from_id(sheet_id).clone();

        // get all columns
        let columns = sheet.iter_columns().collect::<Vec<_>>();
        assert_eq!(None, columns[0].1.bold.get(1));

        // set a bold value, validate it's in the vec
        sheet.set_formatting_value::<Bold>((2, 1).into(), Some(true));
        let columns = sheet.iter_columns().collect::<Vec<_>>();
        assert_eq!(Some(true), columns[0].1.bold.get(1));

        // assert that get_column matches the column in the vec
        let index = columns[0].0;
        let column = sheet.get_column(index);
        assert_eq!(Some(true), column.unwrap().bold.get(1));

        // existing column
        let mut sheet = sheet.clone();
        let existing_column = sheet.get_or_create_column(2);
        assert_eq!(column, Some(existing_column.1).as_deref());

        // new column
        let mut sheet = sheet.clone();
        let new_column = sheet.get_or_create_column(1);
        assert_eq!(new_column.1, &Column::with_id(new_column.0.id));
    }

    #[test]
    fn test_rows() {
        let (grid, sheet_id, _) = test_setup_basic();
        let sheet = grid.grid().sheet_from_id(sheet_id).clone();

        // get all rows
        let rows = sheet.iter_rows().collect::<Vec<_>>();
        let row = sheet.get_row(1);
        assert_eq!(row, Some(rows[0].1));

        let row = sheet.get_row(2);
        assert_eq!(row, Some(rows[1].1));

        // existing row
        let mut sheet = sheet.clone();
        let existing_row = sheet.get_or_create_row(1);
        assert_eq!(Some(rows[0].1), Some(existing_row.id));

        // new row
        let mut sheet = sheet.clone();
        let new_row = sheet.get_or_create_row(3);
        rows.iter().for_each(|row| assert_ne!(row.1, new_row.id));
    }
}
