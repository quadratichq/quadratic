use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::hash::Hash;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

mod block;
mod column;
mod formatting;
mod js_structs;
mod value;

use block::{Block, BlockContent, CellValueBlockContent, SameValue};
use column::Column;
use js_structs::*;
use value::CellValue;

use crate::formulas::{Array, BasicValue, FormulaError, Value};

use self::block::CellValueOrSpill;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(transparent)]
#[wasm_bindgen]
pub struct SheetId(Uuid);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(transparent)]
#[wasm_bindgen]
pub struct RowId(Uuid);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(transparent)]
#[wasm_bindgen]
pub struct ColumnId(Uuid);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[wasm_bindgen]
pub struct CellRef {
    pub sheet: SheetId,
    pub column: ColumnId,
    pub row: RowId,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[wasm_bindgen]
pub struct RegionRef {
    pub top_left: CellRef,
    pub w: u32,
    pub h: u32,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq)]
#[wasm_bindgen]
#[serde(rename_all = "camelCase")]
pub struct GridBounds {
    pub empty: bool,

    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}
impl Default for GridBounds {
    fn default() -> Self {
        Self {
            empty: true,

            min_x: f64::INFINITY,
            min_y: f64::INFINITY,
            max_x: -f64::INFINITY,
            max_y: -f64::INFINITY,
        }
    }
}
impl GridBounds {
    pub fn empty() -> Self {
        GridBounds::default()
    }
    pub fn clear(&mut self) {
        *self = GridBounds::default()
    }
    pub fn add(&mut self, x: i64, y: i64) {
        self.add_x(x);
        self.add_y(y);
    }
    pub fn add_x(&mut self, x: i64) {
        self.min_x = f64::min(self.min_x, x as f64);
        self.max_x = f64::max(self.max_x, x as f64);
        self.empty &= self.min_y.is_infinite();
    }
    pub fn add_y(&mut self, y: i64) {
        self.min_y = f64::min(self.min_y, y as f64);
        self.max_y = f64::max(self.max_y, y as f64);
        self.empty &= self.min_x.is_infinite();
    }
    pub fn merge(a: Self, b: Self) -> Self {
        GridBounds {
            empty: a.empty && b.empty,
            min_x: f64::min(a.min_x, b.min_x),
            min_y: f64::min(a.min_y, b.min_y),
            max_x: f64::max(a.max_x, b.max_x),
            max_y: f64::max(a.max_y, b.max_y),
        }
    }
}

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct File {
    sheet_ids: IdMap<SheetId, usize>,
    sheets: Vec<Sheet>,
}
impl Default for File {
    fn default() -> Self {
        Self::new()
    }
}
#[wasm_bindgen]
impl File {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut ret = File {
            sheet_ids: IdMap::new(),
            sheets: vec![],
        };
        ret.add_sheet();
        ret
    }

    pub fn add_sheet(&mut self) -> SheetId {
        let id = SheetId(Uuid::new_v4());
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

            data_bounds: GridBounds::empty(),
            format_bounds: GridBounds::empty(),
        });
        self.sheet_ids.add(id, 0);
        id
    }

    pub fn sheet_id_to_index(&self, id: SheetId) -> Option<usize> {
        self.sheet_ids.index_of(id)
    }
    pub fn sheet_index_to_id(&self, index: usize) -> Option<SheetId> {
        self.sheet_ids.id_at(index)
    }

    #[wasm_bindgen(js_name = "updateCells")]
    pub fn js_update_cell_values(&mut self, js_cells: JsValue) -> Result<(), JsValue> {
        let sheet = &mut self.sheets[0];
        let cells: Vec<JsCellValue> = serde_wasm_bindgen::from_value(js_cells)?;
        for cell in cells {
            let column = sheet.get_column_at(cell.x);
            let row = sheet.get_row_at(cell.y);
            let pos = CellRef {
                sheet: sheet.id,
                column,
                row,
            };

            let cell_type = cell.r#type;
            let cell_x = cell.x;
            let cell_y = cell.y;
            let cell_text_value = cell.value.clone();

            if let Some(cell_code) = CellCode::try_from_js_cell(cell, sheet) {
                if let Some(output) = &cell_code.output {
                    if let Ok(result) = &output.result {
                        let spill_value = CellValueOrSpill::Spill { source: pos };
                        match &result.output_value {
                            Value::Single(_) => {
                                sheet.set_cell_at_xy(cell_x, cell_y, spill_value)?;
                            }
                            Value::Array(array) => {
                                for dy in 0..array.height() {
                                    for dx in 0..array.width() {
                                        sheet.set_cell_at_xy(
                                            cell_x + dx as i64,
                                            cell_y + dy as i64,
                                            spill_value.clone(),
                                        )?;
                                    }
                                }
                            }
                        }
                    }
                }
                sheet.code_cells.insert(pos, cell_code);
            } else {
                match cell_type {
                    JsCellType::Text => {
                        sheet.set_cell_at_xy(cell_x, cell_y, CellValue::Text(cell_text_value))?
                    }

                    // we add computed cells with the original code that produced them
                    JsCellType::Computed => (),

                    _ => return Err("invalid cell data".into()),
                }
            }

            sheet.data_bounds.add(cell_x, cell_y);
        }

        Ok(())
    }

    #[wasm_bindgen(js_name = "updateCellFormats")]
    pub fn js_update_cell_formats(&mut self, js_cell_formats: JsValue) -> Result<(), JsValue> {
        let sheet = &mut self.sheets[0];
        let cell_formats: Vec<JsCellFormat> = serde_wasm_bindgen::from_value(js_cell_formats)?;
        for cell in cell_formats {
            let column_id = sheet.get_column_at(cell.x);
            let column = sheet.column_mut(column_id).ok_or("bad column ID")?;

            column.align.set(cell.y, cell.alignment);
            column.bold.set(cell.y, cell.bold);
            column.fill_color.set(cell.y, cell.fill_color);
            column.italic.set(cell.y, cell.italic);
            column.text_color.set(cell.y, cell.text_color);
            column.numeric_format.set(cell.y, cell.text_format);
            column.wrap.set(cell.y, cell.wrapping);

            sheet.format_bounds.add(cell.x, cell.y);
        }

        Ok(())
    }

    #[wasm_bindgen(js_name = "deleteCells")]
    pub fn js_clear_cells(&mut self, js_cells: JsValue) -> Result<(), JsValue> {
        let sheet = &mut self.sheets[0];
        let cells: Vec<JsCoordinate> = serde_wasm_bindgen::from_value(js_cells)?;
        for cell in cells {
            sheet.delete_cell_at_xy(cell.x, cell.y);
        }
        Ok(())
    }

    #[wasm_bindgen(js_name = "clearFormat")]
    pub fn js_clear_cell_formats(&mut self, js_cell_formats: JsValue) -> Result<(), JsValue> {
        let sheet = &mut self.sheets[0];
        let cell_formats: Vec<JsCellFormat> = serde_wasm_bindgen::from_value(js_cell_formats)?;
        for cell in cell_formats {
            let column_id = sheet.get_column_at(cell.x);
            let column = sheet.column_mut(column_id).ok_or("bad column ID")?;

            column.align.set(cell.y, None);
            column.bold.set(cell.y, None);
            column.fill_color.set(cell.y, None);
            column.italic.set(cell.y, None);
            column.text_color.set(cell.y, None);
            column.numeric_format.set(cell.y, None);
            column.wrap.set(cell.y, None);
        }

        sheet.recalculate_bounds();

        Ok(())
    }

    #[wasm_bindgen(js_name = "isEmpty")]
    pub fn js_is_empty(&self) -> bool {
        self.sheets[0].is_empty()
    }

    #[wasm_bindgen(js_name = "clear")]
    pub fn js_clear(&mut self) {
        self.sheets.truncate(1);
        self.sheets[0].clear();
    }

    #[wasm_bindgen(js_name = "populate")]
    pub fn js_populate(&mut self, values: JsValue, formats: JsValue) -> Result<(), JsValue> {
        crate::log(&format!("{}", self.sheets.len()));
        self.js_clear();
        self.js_update_cell_values(values)?;
        self.js_update_cell_formats(formats)?;
        Ok(())
    }

    #[wasm_bindgen(js_name = "get")]
    pub fn js_get_cell(&self, x: f64, y: f64) -> Result<JsValue, JsValue> {
        #[derive(Serialize, Deserialize, Debug)]
        struct JsCellAndFormat {
            pub cell: Option<JsCellValue>,
            pub format: Option<JsCellFormat>,
        }

        let x = x as i64;
        let y = y as i64;

        Ok(serde_wasm_bindgen::to_value(&JsCellAndFormat {
            cell: self.js_get_cell_value_internal(x, y),
            format: self.js_get_cell_format_internal(x, y),
        })?)
    }
    #[wasm_bindgen(js_name = "getCell")]
    pub fn js_get_cell_value(&mut self, x: f64, y: f64) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.js_get_cell_value_internal(x as i64, y as i64),
        )?)
    }
    #[wasm_bindgen(js_name = "getValue")]
    pub fn js_get_cell_format(&self, x: f64, y: f64) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.js_get_cell_format_internal(x as i64, y as i64),
        )?)
    }

    fn js_get_cell_value_internal(&self, x: i64, y: i64) -> Option<JsCellValue> {
        let sheet = &self.sheets[0];
        let column = sheet.column_ids.id_at(x)?;
        let row = sheet.row_ids.id_at(y)?;
        let cell_ref = CellRef {
            sheet: sheet.id,
            column,
            row,
        };
        let code_cell = sheet.code_cells.get(&cell_ref);
        let code_cell_output =
            code_cell.and_then(|code_cell| code_cell.output.as_ref()?.result.as_ref().ok());
        let r#type = if let Some(code_cell) = code_cell {
            match code_cell.language {
                CellCodeLanguage::Python => JsCellType::Python,
                CellCodeLanguage::Formula => JsCellType::Formula,
                CellCodeLanguage::JavaScript => JsCellType::JavaScript,
                CellCodeLanguage::Sql => JsCellType::Sql,
            }
        } else if let Some(column) = sheet.column(cell_ref.column) {
            match column.values.get(y) {
                Some(value) => match value {
                    CellValueOrSpill::CellValue(_) => JsCellType::Text,
                    CellValueOrSpill::Spill { .. } => JsCellType::Computed,
                },
                None => return None,
            }
        } else {
            return None;
        };

        Some(JsCellValue {
            x,
            y,
            r#type,
            value: sheet.get_cell(cell_ref).ok()?.to_string(),
            array_cells: None,       // TODO
            dependent_cells: None,   // TODO
            evaluation_result: None, // TODO
            formula_code: None,      // TODO
            last_modified: None,     // TODO
            ai_prompt: None,         // TODO
            python_code: None,       // TODO
        })
    }
    fn js_get_cell_format_internal(&self, x: i64, y: i64) -> Option<JsCellFormat> {
        let x = x as i64;
        let y = y as i64;
        let sheet = &self.sheets[0];
        let column = sheet.columns.get(&x)?;

        Some(JsCellFormat {
            x,
            y,
            alignment: column.align.get(y),
            bold: column.bold.get(y),
            fill_color: column.fill_color.get(y),
            italic: column.italic.get(y),
            text_color: column.text_color.get(y),
            text_format: column.numeric_format.get(y),
            wrapping: column.wrap.get(y),
        })
        .filter(|f| !f.is_default())
    }

    #[wasm_bindgen(js_name = "getNakedCells")]
    pub fn js_get_naked_cell_values(
        &self,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
    ) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &itertools::iproduct!(y0 as i64..=y1 as i64, x0 as i64..=x1 as i64)
                .filter_map(|(y, x)| self.js_get_cell_value_internal(x, y))
                .collect_vec(),
        )?)
    }
    #[wasm_bindgen(js_name = "getNakedFormat")]
    pub fn js_get_naked_cell_format(
        &self,
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
    ) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &itertools::iproduct!(y0 as i64..=y1 as i64, x0 as i64..=x1 as i64)
                .filter_map(|(y, x)| self.js_get_cell_format_internal(x, y))
                .collect_vec(),
        )?)
    }

    #[wasm_bindgen(js_name = "getGridBounds")]
    pub fn js_get_grid_bounds(&self, ignore_formatting: bool) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.sheet_bounds(self.sheets[0].id, ignore_formatting),
        )?)
    }

    #[wasm_bindgen(js_name = "getRowMinMax")]
    pub fn js_get_row_min_max(
        &self,
        row: f64,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        match self.sheets[0].row_bounds(row as i64, ignore_formatting) {
            Some((min, max)) => Ok(serde_wasm_bindgen::to_value(&JsMinMax { min, max })?),
            None => Ok(JsValue::UNDEFINED),
        }
    }
    #[wasm_bindgen(js_name = "getColumnMinMax")]
    pub fn js_get_column_min_max(
        &self,
        column: f64,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        match self.sheets[0].column_bounds(column as i64, ignore_formatting) {
            Some((min, max)) => Ok(serde_wasm_bindgen::to_value(&JsMinMax { min, max })?),
            None => Ok(JsValue::UNDEFINED),
        }
    }

    #[wasm_bindgen(js_name = "getAllCells")]
    pub fn js_get_all_cells(&self) -> Result<JsValue, JsValue> {
        let sheet = &self.sheets[0];
        let bounds = sheet.data_bounds;
        self.js_get_naked_cell_values(bounds.min_x, bounds.min_y, bounds.max_x, bounds.max_y)
    }

    pub fn sheet_bounds(&self, sheet: SheetId, ignore_formatting: bool) -> GridBounds {
        match self.sheet(sheet) {
            Some(sh) => sh.bounds(ignore_formatting),
            None => GridBounds::empty(),
        }
    }

    #[wasm_bindgen(js_name = "getArrays")]
    pub fn js_get_arrays(&self) -> Result<JsValue, JsValue> {
        let sheet = &self.sheets[0];

        let cells = sheet
            .columns
            .iter()
            .flat_map(|(&x, column)| {
                column
                    .values
                    .blocks()
                    .flat_map(|block| block.range())
                    .map(move |y| (x, y))
            })
            .flat_map(|(x, y)| self.js_get_cell_value_internal(x, y))
            .collect();

        let bounds = sheet.format_bounds;
        let formats = if bounds.empty {
            vec![]
        } else {
            itertools::iproduct!(
                bounds.min_y as i64..=bounds.max_y as i64,
                bounds.min_x as i64..=bounds.max_x as i64
            )
            .flat_map(|(y, x)| self.js_get_cell_format_internal(x, y))
            .collect()
        };

        #[derive(Serialize, Deserialize, Debug, Clone)]
        struct JsCellsAndFormats {
            pub cells: Vec<JsCellValue>,
            pub formats: Vec<JsCellFormat>,
        }

        Ok(serde_wasm_bindgen::to_value(&JsCellsAndFormats {
            cells,
            formats,
        })?)
    }

    #[wasm_bindgen(js_name = "recalculateBounds")]
    pub fn recalculate_bounds(&mut self) {
        for sheet in &mut self.sheets {
            sheet.recalculate_bounds()
        }
    }
}
impl File {
    pub fn sheet(&self, id: SheetId) -> Option<&Sheet> {
        self.sheets.get(self.sheet_ids.index_of(id)?)
    }
    pub fn sheet_mut(&mut self, id: SheetId) -> Option<&mut Sheet> {
        self.sheets.get_mut(self.sheet_ids.index_of(id)?)
    }

    pub fn set_cell(&mut self, pos: CellRef, value: CellValue) -> Result<(), &'static str> {
        let sheet = self.sheet_mut(pos.sheet).ok_or("bad sheet ID")?;
        let row_index = sheet.row_ids.index_of(pos.row).ok_or("bad row ID")?;
        let column = sheet.column_mut(pos.column).ok_or("bad column ID")?;
        column.values.set(row_index, Some(value.into()));
        Ok(())
    }
    pub fn get_cell(&self, pos: CellRef) -> Result<CellValue, &'static str> {
        self.sheet(pos.sheet).ok_or("bad sheet ID")?.get_cell(pos)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct IdMap<Id: Hash + Eq, Idx: Ord> {
    id_to_index: HashMap<Id, Idx>,
    index_to_id: BTreeMap<Idx, Id>,
}
impl<Id: Copy + Hash + Eq, Idx: Copy + Ord> IdMap<Id, Idx> {
    pub fn new() -> Self {
        Self {
            id_to_index: HashMap::new(),
            index_to_id: BTreeMap::new(),
        }
    }

    pub fn add(&mut self, id: Id, index: Idx) {
        self.id_to_index.insert(id, index);
        self.index_to_id.insert(index, id);
    }
    pub fn index_of(&self, id: Id) -> Option<Idx> {
        self.id_to_index.get(&id).copied()
    }
    pub fn id_at(&self, idx: Idx) -> Option<Id> {
        self.index_to_id.get(&idx).copied()
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
    pub fn column(&self, id: ColumnId) -> Option<&Column> {
        self.columns.get(&self.column_ids.index_of(id)?)
    }
    pub fn column_mut(&mut self, id: ColumnId) -> Option<&mut Column> {
        self.columns.get_mut(&self.column_ids.index_of(id)?)
    }

    pub fn get_column_at(&mut self, index: i64) -> ColumnId {
        match self.column_ids.id_at(index) {
            Some(id) => id,
            None => {
                let column = Column::new();
                let id = column.id;
                self.column_ids.add(id, index);
                self.columns.insert(index, column);
                id
            }
        }
    }
    pub fn get_row_at(&mut self, index: i64) -> RowId {
        match self.row_ids.id_at(index) {
            Some(id) => id,
            None => {
                let id = RowId(Uuid::new_v4());
                self.row_ids.add(id, index);
                id
            }
        }
    }

    pub fn set_cell_at_xy(
        &mut self,
        x: i64,
        y: i64,
        value: impl Into<CellValueOrSpill>,
    ) -> Result<(), &'static str> {
        // Ensure the column and row exist.
        self.get_column_at(x);
        self.get_row_at(y);

        let column = self.columns.get_mut(&x).ok_or("bad column ID")?;
        column.values.set(y, Some(value.into()));
        Ok(())
    }
    pub fn delete_cell_at_xy(&mut self, x: i64, y: i64) {
        if let Some(column) = self.columns.get_mut(&x) {
            column.values.set(y, None);
        }
    }
    pub fn get_cell(&self, pos: CellRef) -> Result<CellValue, &'static str> {
        let row_index = self.row_ids.index_of(pos.row).ok_or("bad row ID")?;
        let column = self.column(pos.column).ok_or("bad column ID")?;
        match column.values.get(row_index) {
            Some(CellValueOrSpill::CellValue(value)) => Ok(value),
            Some(CellValueOrSpill::Spill { source }) => {
                let get_col_idx = |id| self.column_ids.index_of(id).ok_or("bad column ID");
                let get_row_idx = |id| self.row_ids.index_of(id).ok_or("bad row ID");

                let x = get_col_idx(pos.column)? - get_col_idx(source.column)?;
                let y = get_row_idx(pos.row)? - get_row_idx(source.row)?;

                // IIFE to mimic try_block
                let code_result = (|| {
                    self.code_cells
                        .get(&source)?
                        .output
                        .as_ref()?
                        .result
                        .as_ref()
                        .ok()
                })()
                .ok_or("bad spill ID")?;

                let basic_value = match &code_result.output_value {
                    crate::formulas::Value::Single(value) => value,
                    crate::formulas::Value::Array(array) => array
                        .get(x as u32, y as u32)
                        .map_err(|_| "bad spill size")?,
                };
                Ok(basic_value.clone().into())
            }
            None => Ok(CellValue::Blank),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.data_bounds.empty && self.format_bounds.empty
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
                self.data_bounds.add_x(x);
                self.data_bounds.add_y(data_range.start);
                self.data_bounds.add_y(data_range.end - 1);
            }
            if let Some(format_range) = column.range(false) {
                self.format_bounds.add_x(x);
                self.format_bounds.add_y(format_range.start);
                self.format_bounds.add_y(format_range.end - 1);
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCode {
    language: CellCodeLanguage,
    code_string: String,
    formatted_code_string: Option<String>,
    last_modified: Option<String>, // TODO (investigate chrono/wasm_bindgen compat)
    output: Option<CellCodeRunOutput>,
}
impl CellCode {
    fn try_from_js_cell(cell: JsCellValue, sheet: &mut Sheet) -> Option<Self> {
        let language = match cell.r#type {
            JsCellType::Text | JsCellType::Computed => return None,
            JsCellType::Formula => CellCodeLanguage::Formula,
            JsCellType::JavaScript => CellCodeLanguage::JavaScript,
            JsCellType::Python => CellCodeLanguage::Python,
            JsCellType::Sql => CellCodeLanguage::Sql,
        };

        Some(CellCode {
            language,
            code_string: match language {
                CellCodeLanguage::Python => cell.python_code.unwrap_or_default(),
                CellCodeLanguage::Formula => cell.formula_code.unwrap_or_default(),
                CellCodeLanguage::JavaScript | CellCodeLanguage::Sql => String::new(),
            },
            formatted_code_string: cell
                .evaluation_result
                .as_ref()
                .map(|result| result.formatted_code.clone()),
            last_modified: cell.last_modified,
            output: cell.evaluation_result.and_then(|js_result| {
                let result = match js_result.success {
                    true => Ok(CellCodeRunOk {
                        output_value: if let Some(s) = js_result.output_value.clone() {
                            Value::Single(BasicValue::String(s))
                        } else if let Some(array) = js_result.array_output {
                            let width;
                            let height;
                            let array_contents;

                            match array {
                                JsArrayOutput::Array(values) => {
                                    width = 1;
                                    height = values.len() as u32;
                                    array_contents =
                                        values.iter().map(|v| v.clone().into()).collect();
                                }
                                JsArrayOutput::Block(values) => {
                                    width = values.get(0)?.len() as u32;
                                    height = values.len() as u32;
                                    array_contents =
                                        values.iter().flatten().map(|v| v.clone().into()).collect();
                                }
                            }

                            Value::Array(Array::new_row_major(width, height, array_contents).ok()?)
                        } else {
                            Value::Single(BasicValue::Blank)
                        },
                        cells_accessed: js_result
                            .cells_accessed
                            .iter()
                            .map(|&(x, y)| CellRef {
                                sheet: sheet.id,
                                column: sheet.get_column_at(x),
                                row: sheet.get_row_at(y),
                            })
                            .collect(),
                    }),
                    false => Err(FormulaError {
                        span: js_result
                            .error_span
                            .map(|(start, end)| crate::formulas::Span { start, end }),
                        msg: crate::formulas::FormulaErrorMsg::UnknownError,
                    }),
                };

                Some(CellCodeRunOutput {
                    std_out: js_result.std_out,
                    std_err: js_result.std_err,
                    result,
                })
            }),
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellCodeLanguage {
    Python,
    Formula,
    JavaScript,
    Sql,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCodeRunOutput {
    std_out: Option<String>,
    std_err: Option<String>,
    result: Result<CellCodeRunOk, FormulaError>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCodeRunOk {
    output_value: Value,
    cells_accessed: Vec<CellRef>,
}

#[cfg(test)]
mod tests;
