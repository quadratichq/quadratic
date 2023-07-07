use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::hash::Hash;
use uuid::Uuid;

mod block;
mod column;
mod formatting;
mod value;

use block::{Block, BlockContent, CellValueBlockContent, SameValue};
use column::Column;
use value::CellValue;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SheetId(Uuid);
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct RowId(Uuid);
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct ColumnId(Uuid);
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct CellId {
    sheet: SheetId,
    column: ColumnId,
    row: RowId,
}
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct RegionId {
    top_left: CellId,
    w: u32,
    h: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct File {
    pub sheet_ids: IdMap<SheetId, usize>,
    pub sheets: Vec<Sheet>,
}
impl Default for File {
    fn default() -> Self {
        Self::new()
    }
}
impl File {
    pub fn new() -> Self {
        let mut ret = Self::default();
        ret.add_sheet();
        ret
    }

    pub fn add_sheet(&mut self) -> SheetId {
        let sheet_id = SheetId(Uuid::new_v4());
        self.sheets.push(Sheet {
            color: None,
            name: format!("Sheet {}", self.sheets.len() + 1),

            column_ids: IdMap::new(),
            row_ids: IdMap::new(),
            columns: BTreeMap::new(),
            column_widths: BTreeMap::new(),
            row_heights: BTreeMap::new(),
            code_cells: HashMap::new(),
        });
        self.sheet_ids.add(sheet_id, 0);
        sheet_id
    }

    pub fn sheet(&self, id: SheetId) -> Option<&Sheet> {
        self.sheets.get(self.sheet_ids.index_of(id)?)
    }
    pub fn sheet_mut(&mut self, id: SheetId) -> Option<&mut Sheet> {
        self.sheets.get_mut(self.sheet_ids.index_of(id)?)
    }

    pub fn set_cell(&mut self, pos: CellId, value: CellValue) -> Result<(), ()> {
        let sheet = self.sheet_mut(pos.sheet).ok_or(())?;
        let row_index = sheet.row_ids.index_of(pos.row).ok_or(())?;
        let column = sheet.column_mut(pos.column).ok_or(())?;
        column.values.set(row_index, value.into());
        Ok(())
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
    name: String,

    column_ids: IdMap<ColumnId, i64>,
    row_ids: IdMap<RowId, i64>,

    columns: BTreeMap<i64, Column>,

    column_widths: BTreeMap<i64, f32>,
    row_heights: BTreeMap<i64, f32>,

    code_cells: HashMap<CellId, CellCode>,
}
impl Sheet {
    pub fn column(&self, id: ColumnId) -> Option<&Column> {
        self.columns.get(&self.column_ids.index_of(id)?)
    }
    pub fn column_mut(&mut self, id: ColumnId) -> Option<&mut Column> {
        self.columns.get_mut(&self.column_ids.index_of(id)?)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CellCode {
    language: CellCodeLanguage,
    code_string: String,
    last_modified: (), // TODO (investigate chrono/wasm_bindgen compat)
    result: CellCodeResult,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellCodeLanguage {
    Python,
    Formula,
}

pub type CellCodeResult = Result<crate::formulas::Value, crate::formulas::FormulaError>; // TODO error type
