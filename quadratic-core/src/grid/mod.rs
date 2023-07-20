use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{btree_map, BTreeMap, HashMap};
use std::hash::Hash;
use wasm_bindgen::prelude::*;

mod block;
mod bounds;
mod code;
mod column;
mod formatting;
mod ids;
mod js_structs;
mod legacy;
mod value;

pub use bounds::GridBounds;
pub use code::*;
pub use ids::*;
pub use value::CellValue;

use crate::formulas::Value;
use crate::{Pos, Rect};
use block::{Block, BlockContent, CellValueBlockContent, CellValueOrSpill, SameValue};
use column::Column;
use js_structs::{JsRenderCellsArray, JsRenderCellsBlock};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[wasm_bindgen]
pub struct File {
    sheet_ids: IdMap<SheetId, usize>,
    sheets: Vec<Sheet>,
}
impl Default for File {
    fn default() -> Self {
        Self::new()
    }
}
impl File {
    pub fn from_legacy(file: &legacy::GridFile) -> Result<Self> {
        use legacy::*;

        let GridFile::V1_2(file) = file;
        let mut ret = File::new();
        let sheet = &mut ret.sheets_mut()[0];

        // Load cell data
        for js_cell in &file.cells {
            let column = sheet.get_or_create_column(js_cell.x).0.id;

            if let Some(cell_value) = js_cell.to_cell_value() {
                let x = js_cell.x;
                let y = js_cell.y;
                sheet.set_cell_value(Pos { x, y }, Some(cell_value.into()));
            }
            if let Some(cell_code) = js_cell.to_cell_code(sheet) {
                let row = sheet.get_or_create_row(js_cell.y).id;
                let code_cell_ref = CellRef {
                    sheet: sheet.id,
                    column,
                    row,
                };
                if let Some(output) = &cell_code.output {
                    if let Ok(result) = &output.result {
                        let spill_value = Some(CellValueOrSpill::Spill {
                            source: code_cell_ref,
                        });
                        match &result.output_value {
                            Value::Single(_) => {
                                let x = js_cell.x;
                                let y = js_cell.y;
                                sheet.set_cell_value(Pos { x, y }, spill_value);
                            }
                            Value::Array(array) => {
                                for dy in 0..array.height() {
                                    for dx in 0..array.width() {
                                        let x = js_cell.x + dx as i64;
                                        let y = js_cell.y + dy as i64;
                                        sheet.set_cell_value(Pos { x, y }, spill_value.clone());
                                    }
                                }
                            }
                        }
                    }
                }
                sheet.code_cells.insert(code_cell_ref, cell_code);
            }
        }

        for js_format in &file.formats {
            let (_, column) = sheet.get_or_create_column(js_format.x);

            column.align.set(js_format.y, js_format.alignment);
            column.bold.set(js_format.y, js_format.bold);
            column
                .fill_color
                .set(js_format.y, js_format.fill_color.clone());
            column.italic.set(js_format.y, js_format.italic);
            column
                .text_color
                .set(js_format.y, js_format.text_color.clone());
            column
                .numeric_format
                .set(js_format.y, js_format.text_format);
            column.wrap.set(js_format.y, js_format.wrapping);
        }

        sheet.recalculate_bounds();

        Ok(ret)
    }

    pub fn sheets(&self) -> &[Sheet] {
        &self.sheets
    }
    pub fn sheets_mut(&mut self) -> &mut [Sheet] {
        &mut self.sheets
    }
}
#[wasm_bindgen]
impl File {
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_from_legacy(file: JsValue) -> Result<File, JsValue> {
        let file = serde_wasm_bindgen::from_value(file)?;
        File::from_legacy(&file).map_err(|e| JsError::new(&e.to_string()).into())
    }

    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut ret = File {
            sheet_ids: IdMap::new(),
            sheets: vec![],
        };
        ret.add_sheet();
        ret
    }

    #[wasm_bindgen]
    pub fn add_sheet(&mut self) -> SheetId {
        let id = SheetId::new();
        self.sheets.push(Sheet {
            id,
            color: None,
            name: format!("Sheet {}", self.sheets.len() + 1),

            column_ids: IdMap::new(),
            row_ids: IdMap::new(),
            columns: BTreeMap::new(),
            column_widths: BTreeMap::new(),
            row_heights: BTreeMap::new(),
            code_cells: HashMap::new(),

            data_bounds: GridBounds::Empty,
            format_bounds: GridBounds::Empty,
        });
        self.sheet_ids.add(id, 0);
        id
    }

    #[wasm_bindgen]
    pub fn sheet_id_to_index(&self, id: SheetId) -> Option<usize> {
        self.sheet_ids.index_of(id)
    }
    #[wasm_bindgen]
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        self.sheet_ids.id_at(index)
    }

    #[wasm_bindgen(js_name = "populateWithRandomFloats")]
    pub fn populate_with_random_floats(&mut self, sheet_index: usize, region: Rect) {
        let sheet = &mut self.sheets[sheet_index];
        for x in region.x_range() {
            let (_, column) = sheet.get_or_create_column(x);
            for y in region.y_range() {
                // Generate a random value with precision 0.1 in a range from
                // -10 to +10.
                let value = (js_sys::Math::random() * 201.0).floor() / 10.0 - 10.0;

                column.values.set(y, Some(value.into()));
            }
        }
        sheet.recalculate_bounds();
    }

    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_index: usize, region: Rect) -> Result<JsValue, JsValue> {
        let mut ret = JsRenderCellsArray { columns: vec![] };
        let sheet = &self.sheets[sheet_index];
        for x in region.x_range() {
            let mut ret_column = vec![];
            if let Some(column) = sheet.get_column(x) {
                for block in column
                    .values
                    .blocks_covering_range(region.min.y..region.max.y + 1)
                {
                    ret_column.push(JsRenderCellsBlock {
                        start: block.start(),
                        values: match block.content() {
                            CellValueBlockContent::Values(values) => {
                                values.iter().map(|v| v.to_string()).collect()
                            }
                            CellValueBlockContent::Spill { source, len } => {
                                std::iter::repeat(format!("TODO spill from {source:?}"))
                                    .take(*len)
                                    .collect()
                            }
                        },
                    });
                }
            }
            ret.columns.push(ret_column)
        }
        Ok(serde_wasm_bindgen::to_value(&ret)?)
    }

    #[wasm_bindgen(js_name = "getRenderCell")]
    pub fn get_render_cell(&self, sheet_index: usize, pos: Pos) -> Option<String> {
        match self.sheets[sheet_index].get_cell_value(pos) {
            CellValueOrSpill::CellValue(value) => Some(value.to_string()),
            CellValueOrSpill::Spill { source } => Some(format!("TODO spill from {source:?}")),
        }
    }

    #[wasm_bindgen(js_name = "getGridBounds")]
    pub fn get_grid_bounds(
        &self,
        sheet_index: usize,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.sheets[sheet_index].bounds(ignore_formatting),
        )?)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Sheet {
    color: Option<[u8; 3]>,
    id: SheetId,
    name: String,

    column_ids: IdMap<ColumnId, i64>,
    row_ids: IdMap<RowId, i64>,

    columns: BTreeMap<i64, Column>,

    column_widths: BTreeMap<i64, f32>,
    row_heights: BTreeMap<i64, f32>,

    code_cells: HashMap<CellRef, CellCode>,

    data_bounds: GridBounds,
    format_bounds: GridBounds,
}
impl Sheet {
    /// Sets a cell value and returns a response object, which contains column &
    /// row IDs and the old cell value. Returns `None` if the cell was deleted
    /// and did not previously exist (so no change is needed). The reason for
    /// this is that the column and/or row may never have been generated,
    /// because there's no need.
    pub fn set_cell_value(
        &mut self,
        pos: Pos,
        value: Option<CellValueOrSpill>,
    ) -> Option<SetCellResponse<CellValueOrSpill>> {
        if value.is_none() && !self.columns.contains_key(&pos.x) {
            return None;
        }

        let (column_response, column) = self.get_or_create_column(pos.x);
        let old_value = column.values.set(pos.y, value).unwrap_or_default();
        let row_response = self.get_or_create_row(pos.y);
        Some(SetCellResponse {
            column: column_response,
            row: row_response,
            old_value,
        })
    }
    /// Returns a cell value.
    pub fn get_cell_value(&self, pos: Pos) -> CellValueOrSpill {
        self.get_column(pos.x)
            .and_then(|column| column.values.get(pos.y))
            .unwrap_or_default()
    }

    fn get_column(&self, index: i64) -> Option<&Column> {
        self.columns.get(&index)
    }
    fn get_or_create_column(&mut self, index: i64) -> (GetIdResponse<ColumnId>, &mut Column) {
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
    fn get_or_create_row(&mut self, index: i64) -> GetIdResponse<RowId> {
        match self.row_ids.id_at(index) {
            Some(id) => GetIdResponse::old(id),
            None => {
                let id = RowId::new();
                self.row_ids.add(id, index);
                GetIdResponse::new(id)
            }
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
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SetCellResponse<V> {
    pub column: GetIdResponse<ColumnId>,
    pub row: GetIdResponse<RowId>,
    pub old_value: V,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct GetIdResponse<I> {
    pub id: I,
    pub is_new: bool,
}
impl<I> GetIdResponse<I> {
    fn new(id: I) -> Self {
        Self { id, is_new: true }
    }
    fn old(id: I) -> Self {
        Self { id, is_new: false }
    }
}

#[cfg(test)]
mod tests;
