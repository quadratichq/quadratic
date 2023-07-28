use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::{btree_map, BTreeMap, HashMap};
use std::fmt;
use std::hash::Hash;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

mod block;
mod borders;
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

use crate::formulas::{Array, ArraySize, Value};
use crate::{Pos, Rect};
use block::{Block, BlockContent, CellValueBlockContent, SameValue};
use borders::{CellBorder, SheetBorders};
use column::{BoolSummary, Column, ColumnData};
use formatting::{CellAlign, CellWrap, NumericFormat};
use js_structs::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[wasm_bindgen]
pub struct File {
    sheet_ids: IdMap<SheetId, usize>,
    sheets: Vec<Sheet>,

    created: f64,
    filename: String,
    id: Uuid,
    modified: f64,
}
impl Default for File {
    fn default() -> Self {
        Self::new()
    }
}
impl File {
    pub fn from_legacy(file: &legacy::GridFile) -> Result<Self> {
        use legacy::*;

        let GridFile::V1_3(file) = file;
        let mut ret = File::new();
        ret.sheets = vec![];
        for js_sheet in &file.sheets {
            let sheet_id = ret.add_sheet();
            let sheet_index = ret.sheet_id_to_index(&sheet_id).unwrap();
            let sheet = &mut ret.sheets_mut()[sheet_index];

            // Load cell data
            for js_cell in &js_sheet.cells {
                let column = sheet.get_or_create_column(js_cell.x).0.id;

                if let Some(cell_code) = js_cell.to_cell_code(sheet) {
                    let row = sheet.get_or_create_row(js_cell.y).id;
                    let code_cell_ref = CellRef {
                        sheet: sheet.id,
                        column,
                        row,
                    };
                    if let Some(output) = &cell_code.output {
                        if let Ok(result) = &output.result {
                            let source = code_cell_ref;
                            match &result.output_value {
                                Value::Single(_) => {
                                    let x = js_cell.x;
                                    let y = js_cell.y;
                                    let column = sheet.get_or_create_column(x).1;
                                    column.spills.set(y, Some(source));
                                }
                                Value::Array(array) => {
                                    for dy in 0..array.height() {
                                        for dx in 0..array.width() {
                                            let x = js_cell.x + dx as i64;
                                            let y = js_cell.y + dy as i64;
                                            let column = sheet.get_or_create_column(x).1;
                                            column.spills.set(y, Some(source));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    sheet.code_cells.insert(code_cell_ref, cell_code);
                } else if let Some(cell_value) = js_cell.to_cell_value() {
                    let x = js_cell.x;
                    let y = js_cell.y;
                    sheet.set_cell_value(&Pos { x, y }, cell_value);
                }
            }

            for js_format in &js_sheet.formats {
                let (_, column) = sheet.get_or_create_column(js_format.x);

                column.align.set(js_format.y, js_format.alignment);
                column.wrap.set(js_format.y, js_format.wrapping);

                column
                    .numeric_format
                    .set(js_format.y, js_format.text_format.clone());

                column.bold.set(js_format.y, js_format.bold);
                column.italic.set(js_format.y, js_format.italic);

                column
                    .text_color
                    .set(js_format.y, js_format.text_color.clone());
                column
                    .fill_color
                    .set(js_format.y, js_format.fill_color.clone());
            }

            sheet.recalculate_bounds();
        }

        Ok(ret)
    }

    pub fn sheets(&self) -> &[Sheet] {
        &self.sheets
    }
    pub fn sheets_mut(&mut self) -> &mut [Sheet] {
        &mut self.sheets
    }

    pub fn sheet_from_id(&self, sheet_id: &SheetId) -> &Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &self.sheets[sheet_index]
    }
    pub fn sheet_mut_from_id(&mut self, sheet_id: &SheetId) -> &mut Sheet {
        let sheet_index = self.sheet_id_to_index(sheet_id).expect("bad sheet ID");
        &mut self.sheets[sheet_index]
    }

    fn set_same_values<T: fmt::Debug + Clone + PartialEq>(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        pick_column_data: fn(&mut Column) -> &mut ColumnData<SameValue<T>>,
        value: T,
    ) {
        let sheet = self.sheet_mut_from_id(sheet_id);
        for x in region.x_range() {
            let column = sheet.get_or_create_column(x).1;
            pick_column_data(column).set_range(region.y_range(), value.clone());
        }
    }

    pub fn to_file(&self) -> legacy::GridFileV1_3 {
        legacy::GridFileV1_3 {
            sheets: self
                .sheets
                .iter()
                .map(|sheet| legacy::JsSheet {
                    borders: sheet.borders.export_to_js_file(),
                    cells: match sheet.bounds(false) {
                        GridBounds::Empty => vec![],
                        GridBounds::NonEmpty(region) => sheet
                            .get_render_cells(&region)
                            .into_iter()
                            .map(|cell| {
                                let pos = Pos {
                                    x: cell.x,
                                    y: cell.y,
                                };
                                let code_cell = sheet
                                    .get_cell_ref(&pos)
                                    .and_then(|cell_ref| sheet.code_cells.get(&cell_ref));
                                legacy::JsCell {
                                    x: cell.x,
                                    y: cell.y,
                                    r#type: sheet.get_legacy_cell_type(&pos),
                                    value: cell.value.to_string(),
                                    array_cells: code_cell.and_then(|code_cell| {
                                        let array_output = &code_cell
                                            .output
                                            .as_ref()?
                                            .result
                                            .as_ref()
                                            .ok()?
                                            .output_value;
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
                                        (code_cell.language == CellCodeLanguage::Formula)
                                            .then(|| code_cell.code_string.clone())
                                    }),
                                    last_modified: None, // TODO: last modified
                                    ai_prompt: None,
                                    python_code: code_cell.as_ref().and_then(|code_cell| {
                                        (code_cell.language == CellCodeLanguage::Python)
                                            .then(|| code_cell.code_string.clone())
                                    }),
                                }
                            })
                            .collect(),
                    },
                    cell_dependency: "{}".to_string(), // TODO: cell dependencies
                    columns: vec![],                   // TODO: column headers
                    formats: match sheet.bounds(false) {
                        GridBounds::Empty => vec![],
                        GridBounds::NonEmpty(region) => sheet
                            .get_render_cells(&region)
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
                })
                .collect(),
            created: self.created,
            filename: self.filename.clone(),
            id: self.id.to_string(),
            modified: self.modified,
        }
    }

    fn delete_cell_columns<T: fmt::Debug + Clone + PartialEq>(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        pick_column_data: fn(&mut Column) -> &mut ColumnData<SameValue<T>>,
    ) {
        let sheet = self.sheet_mut_from_id(sheet_id);
        for x in region.x_range() {
            let column = sheet.get_or_create_column(x).1;
            pick_column_data(column).remove_range(region.y_range());
        }
    }
}

#[wasm_bindgen]
impl File {
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(file: JsValue) -> Result<File, JsValue> {
        let file = serde_wasm_bindgen::from_value(file)?;
        File::from_legacy(&file).map_err(|e| JsError::new(&e.to_string()).into())
    }

    #[wasm_bindgen(js_name = "exportToFile")]
    pub fn js_export_to_file(&self) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.to_file())?)
    }

    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut ret = File {
            sheet_ids: IdMap::new(),
            sheets: vec![],

            created: 0.0, // TODO: creation time
            filename: "Untitled".to_string(),
            id: Uuid::new_v4(),
            modified: 0.0, // TODO: modification time
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

            borders: SheetBorders::new(),

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
    pub fn sheet_id_to_index(&self, id: &SheetId) -> Option<usize> {
        self.sheet_ids.index_of(*id)
    }
    #[wasm_bindgen]
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        self.sheet_ids.id_at(index)
    }

    #[wasm_bindgen(js_name = "populateWithRandomFloats")]
    pub fn populate_with_random_floats(&mut self, sheet_id: &SheetId, region: &Rect) {
        let sheet = self.sheet_mut_from_id(sheet_id);
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

    #[wasm_bindgen(js_name = "recalculateBounds")]
    pub fn recalculate_bounds(&mut self, sheet_id: &SheetId) {
        self.sheet_mut_from_id(sheet_id).recalculate_bounds();
    }
    #[wasm_bindgen(js_name = "getGridBounds")]
    pub fn get_grid_bounds(
        &self,
        sheet_id: &SheetId,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.sheet_from_id(sheet_id).bounds(ignore_formatting),
        )?)
    }

    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: &SheetId, region: &Rect) -> Result<String, JsValue> {
        let output = self.sheet_from_id(sheet_id).get_render_cells(region);
        Ok(serde_json::to_string::<[JsRenderCell]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "getRenderFills")]
    pub fn get_render_fills(&self, sheet_id: &SheetId, region: &Rect) -> Result<String, JsValue> {
        let output = self.sheet_from_id(sheet_id).get_render_fills(region);
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "getRenderHorizontalBorders")]
    pub fn get_render_horizontal_borders(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<String, JsValue> {
        let output = self
            .sheet_from_id(sheet_id)
            .borders
            .get_render_horizontal_borders(region);
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }
    #[wasm_bindgen(js_name = "getRenderVerticalBorders")]
    pub fn get_render_vertical_borders(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<String, JsValue> {
        let output = self
            .sheet_from_id(sheet_id)
            .borders
            .get_render_vertical_borders(region);
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn set_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
        cell_value: JsValue,
    ) -> Result<(), JsValue> {
        let cell_value: CellValue = serde_wasm_bindgen::from_value(cell_value)?;
        self.sheet_mut_from_id(sheet_id)
            .set_cell_value(pos, cell_value);
        Ok(())
    }

    #[wasm_bindgen(js_name = "deleteCellValues")]
    pub fn delete_cell_values(&mut self, sheet_id: &SheetId, region: &Rect) -> Result<(), JsValue> {
        self.sheet_mut_from_id(sheet_id).delete_cell_values(region);
        Ok(())
    }

    #[wasm_bindgen(js_name = "getCodeCellValue")]
    pub fn get_code_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
    ) -> Result<JsValue, JsValue> {
        let sheet = self.sheet_from_id(sheet_id);
        let Some(cell_ref) = sheet.get_cell_ref(pos) else {
            return Ok(JsValue::UNDEFINED);
        };
        let Some(code_cell) = sheet.code_cells.get(&cell_ref) else {
            return Ok(JsValue::UNDEFINED);
        };
        Ok(serde_wasm_bindgen::to_value(&code_cell)?)
    }

    #[wasm_bindgen(js_name = "setCodeCellValue")]
    pub fn set_code_cell_value(
        &mut self,
        sheet_id: &SheetId,
        pos: &Pos,
        code_cell_value: JsValue,
    ) -> Result<(), JsValue> {
        let code_cell_value: CodeCellValue = serde_wasm_bindgen::from_value(code_cell_value)?;
        let sheet = self.sheet_mut_from_id(sheet_id);
        let cell_ref = sheet.get_or_create_cell_ref(pos);
        sheet.code_cells.insert(cell_ref, code_cell_value);
        // TODO: return old code cell
        Ok(())
    }

    #[wasm_bindgen(js_name = "getFormattingSummary")]
    pub fn get_formatting_summary(
        &self,
        sheet_id: &SheetId,
        region: &Rect,
    ) -> Result<JsValue, JsValue> {
        let sheet = self.sheet_from_id(sheet_id);

        let mut bold = BoolSummary::default();
        let mut italic = BoolSummary::default();

        for x in region.x_range() {
            match sheet.columns.get(&x) {
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

        Ok(serde_wasm_bindgen::to_value(&JsFormattingSummary {
            bold,
            italic,
        })?)
    }

    #[wasm_bindgen(js_name = "setCellAlign")]
    pub fn set_cell_align(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellAlign = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(sheet_id, region, |column| &mut column.align, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setCellWrap")]
    pub fn set_cell_wrap(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellWrap = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(sheet_id, region, |column| &mut column.wrap, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setHorizontalCellBorder")]
    pub fn set_horizontal_cell_border(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellBorder = serde_wasm_bindgen::from_value(value)?;
        self.sheet_mut_from_id(sheet_id)
            .borders
            .set_horizontal_border(region, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setVerticalCellBorder")]
    pub fn set_vertical_cell_border(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: CellBorder = serde_wasm_bindgen::from_value(value)?;
        self.sheet_mut_from_id(sheet_id)
            .borders
            .set_vertical_border(region, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setCellNumericFormat")]
    pub fn set_cell_numeric_format(
        &mut self,
        sheet_id: &SheetId,
        region: &Rect,
        value: JsValue,
    ) -> Result<(), JsValue> {
        let value: NumericFormat = serde_wasm_bindgen::from_value(value)?;
        self.set_same_values(sheet_id, region, |column| &mut column.numeric_format, value);
        Ok(())
    }
    #[wasm_bindgen(js_name = "setCellBold")]
    pub fn set_cell_bold(&mut self, sheet_id: &SheetId, region: &Rect, value: bool) {
        self.set_same_values(sheet_id, region, |column| &mut column.bold, value);
    }
    #[wasm_bindgen(js_name = "setCellItalic")]
    pub fn set_cell_italic(&mut self, sheet_id: &SheetId, region: &Rect, value: bool) {
        self.set_same_values(sheet_id, region, |column| &mut column.italic, value);
    }
    #[wasm_bindgen(js_name = "setCellTextColor")]
    pub fn set_cell_text_color(&mut self, sheet_id: &SheetId, region: &Rect, value: String) {
        self.set_same_values(sheet_id, region, |column| &mut column.text_color, value);
    }
    #[wasm_bindgen(js_name = "setCellFillColor")]
    pub fn set_cell_fill_color(&mut self, sheet_id: &SheetId, region: &Rect, value: String) {
        self.set_same_values(sheet_id, region, |column| &mut column.fill_color, value);
    }
    #[wasm_bindgen(js_name = "clearFormatting")]
    pub fn clear_formatting(&mut self, sheet_id: &SheetId, region: &Rect) {
        self.delete_cell_columns(sheet_id, region, |column| &mut column.fill_color);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.align);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.bold);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.italic);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.numeric_format);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.text_color);
        self.delete_cell_columns(sheet_id, region, |column| &mut column.wrap);
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

    borders: SheetBorders,

    column_widths: BTreeMap<i64, f32>,
    row_heights: BTreeMap<i64, f32>,

    code_cells: HashMap<CellRef, CodeCellValue>,

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

    fn get_legacy_cell_type(&self, pos: &Pos) -> legacy::JsCellType {
        if self
            .get_column(pos.x)
            .and_then(|column| column.spills.get(pos.y))
            .is_some()
        {
            let code_cell = self
                .get_cell_ref(pos)
                .and_then(|cell_ref| self.code_cells.get(&cell_ref));

            if let Some(code_cell) = code_cell {
                match code_cell.language {
                    CellCodeLanguage::Python => legacy::JsCellType::Python,
                    CellCodeLanguage::Formula => legacy::JsCellType::Formula,
                    CellCodeLanguage::JavaScript => legacy::JsCellType::Javascript,
                    CellCodeLanguage::Sql => legacy::JsCellType::Sql,
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
    /// Create a `CellRef` if the column and row already exist.
    fn get_cell_ref(&self, pos: &Pos) -> Option<CellRef> {
        Some(CellRef {
            sheet: self.id,
            column: self.column_ids.id_at(pos.x)?,
            row: self.row_ids.id_at(pos.y)?,
        })
    }
    /// Create a `CellRef`, creating the column and row if they do not already
    /// exist.
    fn get_or_create_cell_ref(&mut self, pos: &Pos) -> CellRef {
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
        region
            .x_range()
            .filter_map(move |x| {
                let column = self.get_column(x)?;

                // These are the four rendering layers. All other formatting
                // only matters if a value is present.
                let mut fill_colors = column.fill_color.iter_range(region.y_range()).peekable();
                let mut values = column.values.iter_range(region.y_range()).peekable();
                let mut spills = column
                    .spills
                    .iter_range(region.y_range())
                    .filter_map(move |(y, source)| {
                        let dx = x - self.column_ids.index_of(source.column)?;
                        let dy = y - self.row_ids.index_of(source.row)?;
                        let value = self.code_cells.get(&source)?.get(dx as u32, dy as u32)?;
                        Some((y, value.clone()))
                    })
                    .peekable();

                Some(region.y_range().filter_map(move |y| {
                    let fill_color = fill_colors.next_if(|&(y2, _)| y2 == y).map(|(_, v)| v);
                    let manual_value = values.next_if(|&(y2, _)| y2 == y).map(|(_, v)| v);
                    let spill_value = spills.next_if(|&(y2, _)| y2 == y).map(|(_, v)| v);

                    if fill_color.is_none() && manual_value.is_none() && spill_value.is_none() {
                        return None; // Nothing to render
                    }

                    let value = manual_value.or(spill_value).unwrap_or_default();

                    Some(JsRenderCell {
                        x,
                        y,
                        value,

                        align: column.align.get(y),
                        wrap: column.wrap.get(y),
                        numeric_format: column.numeric_format.get(y),
                        bold: column.bold.get(y),
                        italic: column.italic.get(y),
                        text_color: column.text_color.get(y),
                        fill_color,
                    })
                }))
            })
            .flatten()
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

    fn unspill(&mut self, source: CellRef) {
        // TODO: unspill cells
        // let code_cell = self.code_cells.get(source).expect("bad code cell ID");
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[must_use]
pub struct SetCellResponse<V> {
    pub column: GetIdResponse<ColumnId>,
    pub row: GetIdResponse<RowId>,
    pub old_value: V,

    pub spill: Option<CellRef>,
    pub unspill: Option<CellRef>,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[must_use]
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
