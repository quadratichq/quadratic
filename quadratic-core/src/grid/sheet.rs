use serde::{Deserialize, Serialize};
use std::collections::{btree_map, BTreeMap, HashMap, HashSet};

use super::borders::SheetBorders;
use super::bounds::GridBounds;
use super::code::{CodeCellLanguage, CodeCellValue};
use super::column::Column;
use super::ids::{CellRef, ColumnId, IdMap, RowId, SheetId};
use super::js_structs::{JsRenderCell, JsRenderFill};
use super::legacy;
use super::response::{GetIdResponse, SetCellResponse};
use super::value::CellValue;
use crate::{Pos, Rect};

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
    pub(super) columns: BTreeMap<i64, Column>,
    pub(super) borders: SheetBorders,
    #[serde(with = "crate::util::hashmap_serde")]
    pub(super) code_cells: HashMap<CellRef, CodeCellValue>,

    data_bounds: GridBounds,
    format_bounds: GridBounds,
}
impl Sheet {
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

    /// Sets a cell value and returns a response object, which contains column &
    /// row IDs and the old cell value. Returns `None` if the cell was deleted
    /// and did not previously exist (so no change is needed). The reason for
    /// this is that the column and/or row may never have been generated,
    /// because there's no need.
    pub fn set_cell_value(
        &mut self,
        pos: &Pos,
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
    /// Returns a cell value.
    pub fn get_cell_value(&self, pos: Pos) -> Option<CellValue> {
        self.get_column(pos.x)
            .and_then(|column| column.values.get(pos.y))
    }

    pub fn delete_cell_values(&mut self, region: &Rect) {
        for x in region.x_range() {
            if let Some(column) = self.columns.get_mut(&x) {
                column.values.remove_range(region.y_range());
            }
        }
    }

    pub(super) fn get_legacy_cell_type(&self, pos: &Pos) -> legacy::JsCellType {
        if self
            .get_column(pos.x)
            .and_then(|column| column.spills.get(pos.y))
            .is_some()
        {
            let code_cell = self
                .try_create_cell_ref(pos)
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

    fn get_column(&self, index: i64) -> Option<&Column> {
        self.columns.get(&index)
    }
    pub(super) fn get_or_create_column(
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
    pub(super) fn get_or_create_row(&mut self, index: i64) -> GetIdResponse<RowId> {
        match self.row_ids.id_at(index) {
            Some(id) => GetIdResponse::old(id),
            None => {
                let id = RowId::new();
                self.row_ids.add(id, index);
                GetIdResponse::new(id)
            }
        }
    }
    /// Returns the position for a `CellRef`.
    fn cell_ref_to_pos(&self, cell_ref: CellRef) -> Option<Pos> {
        Some(Pos {
            x: self.column_ids.index_of(cell_ref.column)?,
            y: self.row_ids.index_of(cell_ref.row)?,
        })
    }
    /// Create a `CellRef` if the column and row already exist.
    pub(super) fn try_create_cell_ref(&self, pos: &Pos) -> Option<CellRef> {
        Some(CellRef {
            sheet: self.id,
            column: self.column_ids.id_at(pos.x)?,
            row: self.row_ids.id_at(pos.y)?,
        })
    }
    /// Create a `CellRef`, creating the column and row if they do not already
    /// exist.
    pub(super) fn get_or_create_cell_ref(&mut self, pos: &Pos) -> CellRef {
        CellRef {
            sheet: self.id,
            column: self.get_or_create_column(pos.x).0.id,
            row: self.get_or_create_row(pos.y).id,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.data_bounds.is_empty() && self.format_bounds.is_empty()
    }
    pub fn clear(&mut self) {
        self.column_ids = IdMap::new();
        self.row_ids = IdMap::new();
        self.columns.clear();
        self.code_cells.clear();
        self.recalculate_bounds();
    }

    pub fn bounds(&self, ignore_formatting: bool) -> GridBounds {
        match ignore_formatting {
            true => self.data_bounds,
            false => GridBounds::merge(self.data_bounds, self.format_bounds),
        }
    }
    pub fn column_bounds(&self, x: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column = self.columns.get(&x)?;
        let range = column.range(ignore_formatting)?;
        Some((range.start, range.end - 1))
    }
    pub fn row_bounds(&self, y: i64, ignore_formatting: bool) -> Option<(i64, i64)> {
        let column_has_row = |(_x, column): &(&i64, &Column)| match ignore_formatting {
            true => column.has_anything_in_row(y),
            false => column.has_data_in_row(y),
        };
        let left = *self.columns.iter().find(column_has_row)?.0;
        let right = *self.columns.iter().rfind(column_has_row)?.0;
        Some((left, right))
    }

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

    pub fn get_render_cells(&self, region: &Rect) -> Vec<JsRenderCell> {
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
                    let dx = (code_cell_pos.x - x) as u32;
                    let dy = (code_cell_pos.y - block.y) as u32;

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

    pub fn get_render_fills(&self, region: &Rect) -> Vec<JsRenderFill> {
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

    pub fn iter_code_cells(&self, region: &Rect) -> impl Iterator<Item = (Pos, &CodeCellValue)> {
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

        code_cell_refs.into_iter().filter_map(|cell_ref| {
            Some((
                self.cell_ref_to_pos(cell_ref)?,
                self.code_cells.get(&cell_ref)?,
            ))
        })
    }

    fn unspill(&mut self, source: CellRef) {
        todo!("unspill cells from {source:?}")
    }
}
