use std::collections::{btree_map, BTreeMap, HashMap, HashSet};

use itertools::Itertools;
use rand::Rng;
use serde::{Deserialize, Serialize};

use super::borders::{CellBorder, SheetBorders};
use super::bounds::GridBounds;
use super::code::{CodeCellLanguage, CodeCellValue};
use super::column::Column;
use super::formatting::BoolSummary;
use super::ids::{CellRef, ColumnId, IdMap, RowId, SheetId};
use super::js_types::{
    FormattingSummary, JsRenderBorder, JsRenderCell, JsRenderCodeCell, JsRenderCodeCellState,
    JsRenderFill,
};
use super::response::{GetIdResponse, SetCellResponse};
use super::{legacy, CodeCellRunResult};
use crate::{Array, ArraySize, CellValue, IsBlank, Pos, Rect, Value};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Sheet {
    pub id: SheetId,
    pub name: String,
    pub color: Option<[u8; 3]>,

    column_ids: IdMap<ColumnId, i64>,
    row_ids: IdMap<RowId, i64>,

    #[serde(with = "crate::util::btreemap_serde")]
    column_widths: BTreeMap<i64, f32>,
    #[serde(with = "crate::util::btreemap_serde")]
    row_heights: BTreeMap<i64, f32>,

    #[serde(with = "crate::util::btreemap_serde")]
    columns: BTreeMap<i64, Column>,
    borders: SheetBorders,
    #[serde(with = "crate::util::hashmap_serde")]
    code_cells: HashMap<CellRef, CodeCellValue>,

    data_bounds: GridBounds,
    format_bounds: GridBounds,
}
impl Sheet {
    /// Constructs a new empty sheet.
    pub fn new(id: SheetId, name: String) -> Self {
        Sheet {
            id,
            name,
            color: None,

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

    /// Constructs a new sheet with a region populated with random float values.
    pub fn with_random_floats(id: SheetId, name: String, region: Rect) -> Self {
        let mut rng = rand::thread_rng();
        let mut sheet = Self::new(id, name);
        for x in region.x_range() {
            let (_, column) = sheet.get_or_create_column(x);
            for y in region.y_range() {
                // Generate a random value with precision 0.1 in a range from
                // -10 to +10.
                let value = rng.gen_range(-10000..=10000) as f64;

                column.values.set(y, Some(value.into()));
            }
        }
        sheet.recalculate_bounds();
        sheet
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

        let mut unspill = None;
        if !is_blank {
            if let Some(source) = column.spills.get(pos.y) {
                self.unspill(source);
                unspill = Some(source);
            }
        }

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

        let width = column_ids.len() as u32;
        let height = row_ids.len() as u32;
        let mut old_cell_values_array =
            Array::new_empty(width, height).expect("error constructing array for old cell values");

        for x in region.x_range() {
            let Some(column) = self.columns.get_mut(&x) else {continue};
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

        for cell_ref in self.iter_code_cells_locations(region) {
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
        self.get_column(pos.x)
            .and_then(|column| column.values.get(pos.y))
    }
    /// Returns a code cell value.
    pub fn get_code_cell(&self, pos: Pos) -> Option<&CodeCellValue> {
        self.code_cells.get(&self.try_get_cell_ref(pos)?)
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

    pub fn export_to_legacy_file_format(&self) -> legacy::JsSheet {
        legacy::JsSheet {
            borders: self.borders.export_to_js_file(),
            cells: match self.bounds(false) {
                GridBounds::Empty => vec![],
                GridBounds::NonEmpty(region) => self
                    .get_render_cells(region)
                    .into_iter()
                    .map(|cell| {
                        let pos = Pos {
                            x: cell.x,
                            y: cell.y,
                        };
                        let code_cell = self
                            .try_get_cell_ref(pos)
                            .and_then(|cell_ref| self.code_cells.get(&cell_ref));
                        legacy::JsCell {
                            x: cell.x,
                            y: cell.y,
                            r#type: self.get_legacy_cell_type(pos),
                            value: cell.value.to_string(),
                            array_cells: code_cell.and_then(|code_cell| {
                                let array_output = code_cell.output.as_ref()?.output_value()?;
                                match array_output {
                                    Value::Single(_) => None,
                                    Value::Array(array) => {
                                        let ArraySize { w, h } = array.array_size();
                                        Some(
                                            Array::indices(w, h)
                                                .map(|(dx, dy)| {
                                                    (cell.x + dx as i64, cell.y + dy as i64)
                                                })
                                                .collect(),
                                        )
                                    }
                                }
                            }),
                            dependent_cells: None,
                            evaluation_result: code_cell
                                .and_then(|code_cell| code_cell.js_evaluation_result()),
                            formula_code: code_cell.as_ref().and_then(|code_cell| {
                                (code_cell.language == CodeCellLanguage::Formula)
                                    .then(|| code_cell.code_string.clone())
                            }),
                            last_modified: None, // TODO: last modified
                            ai_prompt: None,
                            python_code: code_cell.as_ref().and_then(|code_cell| {
                                (code_cell.language == CodeCellLanguage::Python)
                                    .then(|| code_cell.code_string.clone())
                            }),
                        }
                    })
                    .collect(),
            },
            cell_dependency: "{}".to_string(), // TODO: cell dependencies
            columns: vec![],                   // TODO: column headers
            formats: match self.bounds(false) {
                GridBounds::Empty => vec![],
                GridBounds::NonEmpty(region) => self
                    .get_render_cells(region)
                    .into_iter()
                    .map(|cell| legacy::JsCellFormat {
                        x: cell.x,
                        y: cell.y,
                        alignment: cell.align,
                        bold: cell.bold,
                        fill_color: cell.fill_color,
                        italic: cell.italic,
                        text_color: cell.text_color,
                        text_format: cell.numeric_format,
                        wrapping: cell.wrap,
                    })
                    .collect(),
            },
            rows: vec![], // TODO: row headers
        }
    }
    /// Returns the type of a cell, according to the legacy file format.
    fn get_legacy_cell_type(&self, pos: Pos) -> legacy::JsCellType {
        if self
            .get_column(pos.x)
            .and_then(|column| column.spills.get(pos.y))
            .is_some()
        {
            let code_cell = self
                .try_get_cell_ref(pos)
                .and_then(|cell_ref| self.code_cells.get(&cell_ref));

            if let Some(code_cell) = code_cell {
                match code_cell.language {
                    CodeCellLanguage::Python => legacy::JsCellType::Python,
                    CodeCellLanguage::Formula => legacy::JsCellType::Formula,
                    CodeCellLanguage::JavaScript => legacy::JsCellType::Javascript,
                    CodeCellLanguage::Sql => legacy::JsCellType::Sql,
                }
            } else {
                legacy::JsCellType::Computed
            }
        } else {
            legacy::JsCellType::Text
        }
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

    pub(crate) fn get_column_index(&self, column_id: ColumnId) -> Option<i64> {
        self.column_ids.index_of(column_id)
    }
    pub(crate) fn get_row_index(&self, row_id: RowId) -> Option<i64> {
        self.row_ids.index_of(row_id)
    }

    /// Returns whether the sheet is completely empty.
    pub fn is_empty(&self) -> bool {
        self.data_bounds.is_empty() && self.format_bounds.is_empty()
    }
    /// Deletes all data and formatting in the sheet, effectively recreating it.
    pub fn clear(&mut self) {
        self.column_ids = IdMap::new();
        self.row_ids = IdMap::new();
        self.columns.clear();
        self.code_cells.clear();
        self.recalculate_bounds();
    }

    /// Returns the bounds of the sheet.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it is
    /// `false`, then data and formatting are both considered.
    pub fn bounds(&self, ignore_formatting: bool) -> GridBounds {
        match ignore_formatting {
            true => self.data_bounds,
            false => GridBounds::merge(self.data_bounds, self.format_bounds),
        }
    }
    /// Returns the lower and upper bounds of a column, or `None` if the column
    /// is empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it is
    /// `false`, then data and formatting are both considered.
    pub fn column_bounds(&self, x: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column = self.columns.get(&x)?;
        let range = column.range(ignore_formatting)?;
        Some((range.start, range.end - 1))
    }
    /// Returns the lower and upper bounds of a row, or `None` if the column is
    /// empty.
    ///
    /// If `ignore_formatting` is `true`, only data is considered; if it
    /// is `false`, then data and formatting are both considered.
    pub fn row_bounds(&self, y: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column_has_row = |(_x, column): &(&i64, &Column)| match ignore_formatting {
            true => column.has_anything_in_row(y),
            false => column.has_data_in_row(y),
        };
        let left = *self.columns.iter().find(column_has_row)?.0;
        let right = *self.columns.iter().rfind(column_has_row)?.0;
        Some((left, right))
    }

    /// Recalculates all bounds of the sheet.
    ///
    /// This should be called whenever data in the sheet is modified.
    pub fn recalculate_bounds(&mut self) {
        self.data_bounds.clear();
        self.format_bounds.clear();

        for (&x, column) in &self.columns {
            if let Some(data_range) = column.range(true) {
                let y = data_range.start;
                self.data_bounds.add(Pos { x, y });
                let y = data_range.end - 1;
                self.data_bounds.add(Pos { x, y });
            }
            if let Some(format_range) = column.range(false) {
                let y = format_range.start;
                self.format_bounds.add(Pos { x, y });
                let y = format_range.end - 1;
                self.format_bounds.add(Pos { x, y });
            }
        }
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
                .iter_range(region.y_range())
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
            .map(|(x, y, column, value, language)| JsRenderCell {
                x,
                y,

                value,
                language,

                align: column.align.get(y),
                wrap: column.wrap.get(y),
                numeric_format: column.numeric_format.get(y),
                bold: column.bold.get(y),
                italic: column.italic.get(y),
                text_color: column.text_color.get(y),
                fill_color: None,
            })
            .collect()
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
        self.iter_code_cells_locations(region)
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                if !region.contains(pos) {
                    return None;
                }
                let code_cell = self.code_cells.get(&cell_ref)?;
                let ArraySize { w, h } = code_cell.output_size();
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
                    w,
                    h,
                    language: code_cell.language,
                    state,
                })
            })
            .collect()
    }
    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.iter_all_code_cells_locations()
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                let code_cell = self.code_cells.get(&cell_ref)?;
                let ArraySize { w, h } = code_cell.output_size();
                Some(JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w,
                    h,
                    language: code_cell.language,
                })
            })
            .collect()
    }
    /// Returns data for all rendering code cells
    pub fn get_all_render_code_cells(&self) -> Vec<JsRenderCodeCell> {
        self.iter_all_code_cells_locations()
            .filter_map(|cell_ref| {
                let pos = self.cell_ref_to_pos(cell_ref)?;
                let code_cell = self.code_cells.get(&cell_ref)?;
                let ArraySize { w, h } = code_cell.output_size();
                Some(JsRenderCodeCell {
                    x: pos.x,
                    y: pos.y,
                    w,
                    h,
                    language: code_cell.language,
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
    fn iter_code_cells_locations(&self, region: Rect) -> impl Iterator<Item = CellRef> {
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

    fn iter_all_code_cells_locations(&self) -> impl Iterator<Item = CellRef> {
        // Scan spilled cells to find code cells. TODO: this won't work for
        // unspilled code cells
        let code_cell_refs: HashSet<CellRef> = self
            .columns
            .iter()
            .flat_map(|(_x, column)| {
                column
                    .spills
                    .get_blocks_all()
                    .map(|block| block.content().value)
            })
            .collect();

        code_cell_refs.into_iter()
    }

    fn unspill(&mut self, source: CellRef) {
        todo!("unspill cells from {source:?}")
    }
}
