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

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[wasm_bindgen]
pub struct GridBounds {
    pub x_min: i64,
    pub x_max: i64,
    pub y_min: i64,
    pub y_max: i64,
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
        let mut ret = Self::default();
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
    pub fn js_update_cells(&mut self, js_cells: JsValue) -> Result<(), JsValue> {
        let sheet = &mut self.sheets[0];
        let cells: Vec<JsCell> = serde_wasm_bindgen::from_value(js_cells)?;
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
        }
        Ok(())
    }

    #[wasm_bindgen(js_name = "set_cell")]
    pub fn js_set_cell(&mut self, pos: CellRef, value: JsValue) -> Result<(), JsValue> {
        Ok(self.set_cell(pos, serde_wasm_bindgen::from_value(value)?)?)
    }

    #[wasm_bindgen(js_name = "get_cell")]
    pub fn js_get_cell(&mut self, pos: CellRef) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.get_cell(pos)?)?)
    }

    pub fn sheet_bounds(&mut self, sheet: SheetId, ignore_formatting: bool) -> Option<GridBounds> {
        self.sheet(sheet)?.bounds(ignore_formatting)
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
        column.values.set(row_index, value.into());
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

    pub fn set_cell_at_xy(&mut self, x: i64, y: i64, value: CellValue) -> Result<(), &'static str> {
        // Ensure the column and row exist.
        self.get_column_at(x);
        self.get_row_at(y);

        let column = self.columns.get_mut(&x).ok_or("bad column ID")?;
        column.values.set(y, value.into());
        Ok(())
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

    pub fn bounds(&self, ignore_formatting: bool) -> Option<GridBounds> {
        let columns = self.columns.iter();
        let mut nonempty_columns = columns.clone().filter(|(_x, column)| {
            if ignore_formatting {
                column.has_anything()
            } else {
                column.has_data()
            }
        });
        let first_col = nonempty_columns.next()?;
        let last_col = nonempty_columns.next_back().unwrap_or(first_col);
        let x_min = *first_col.0;
        let x_max = *last_col.0;

        let y_range =
            crate::util::union_ranges(columns.map(|(_x, column)| column.range(ignore_formatting)))?;
        let y_min = y_range.start;
        let y_max = y_range.end;

        Some(GridBounds {
            x_min,
            x_max,
            y_min,
            y_max,
        })
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
    fn try_from_js_cell(cell: JsCell, sheet: &mut Sheet) -> Option<Self> {
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
