// Used by operations/code_cell.rs to track temporary changes to the Sheet
// to assist in creating operations for spills.

use std::collections::{HashMap, HashSet};
use crate::{grid::{Sheet, SheetId}, Pos, Rect, SheetPos};

#[derive(Debug, Default)]
pub struct TemporarySheets {
    sheets: HashMap<SheetId, TemporarySheet>,
}

impl TemporarySheets {
    pub fn clear(&mut self) {
      self.sheets.clear();
    }

    pub fn set_cell_value(&mut self, sheet_pos: SheetPos) {
      self.sheets.entry(sheet_pos.sheet_id).or_default().set_cell_value(sheet_pos.into());
    }

    pub fn delete_cell_value(&mut self, sheet_pos: SheetPos) {
      self.sheets.entry(sheet_pos.sheet_id).or_default().delete_cell_value(sheet_pos.into());
    }

    /// Whether a cell_value exists at the sheet_pos
    pub fn cell_value_exists(&self, sheet: &Sheet, sheet_pos: SheetPos) -> bool {
      match self.sheets.get(&sheet_pos.sheet_id) {
        Some(temporary) =>
          temporary.cell_value_exists(sheet_pos.into()) || sheet.get_cell_value_only(sheet_pos.into()).is_some(),
        None => false,
      }
    }

    /// Whether a code cell or code cell run exists at the sheet_pos.
    pub fn code_cell_exists(&self, sheet: &Sheet, sheet_pos: SheetPos) -> Option<u32> {
      if let Some(temporary) = self.sheets.get(&sheet_pos.sheet_id) {
        if let Some(last_run) = temporary.code_cell_exists(sheet_pos.into()) {
          return Some(last_run);
        }
      }
      sheet.get_code_cell_run(sheet_pos.into()).map(|run| run.last_code_run)
    }
}

#[derive(Debug, Default)]
pub struct TemporarySheet {
    // whether a code_cell exists at Pos
    code_cell: HashMap<Pos, bool>,

    // temporary code_cell_run
    // maps to (Rect of run output, last_run_time, SheetPos of run, whether deleted)
    code_cell_run: HashMap<Rect, (SheetPos, u32, bool)>,

    // whether cell_value exists at Pos
    values: HashSet<Pos>,
}

impl TemporarySheet {
    /// Adds a temporary cell_value at the Pos
    pub(crate) fn set_cell_value(&self, pos: Pos) {
      self.values.insert(pos);
    }

    /// Removes a temporary cell_value at the Pos
    pub(crate) fn delete_cell_value(&self, pos: Pos) {
      self.values.remove(&pos);
    }

    /// Whether a cell_value exists at the Pos in the Sheet
    pub(crate) fn cell_value_exists(&self, pos: Pos) -> bool {
        self.values.contains(&pos)
    }

    pub(crate) fn set_code_cell(&mut self, rect: Rect, last_run: u32) {
        self.code_cell_sizes.insert(rect, (last_run, time));
    }

    /// Whether a code cell or code cell run exists at the Pos.
    ///
    /// Returns the earliest Unix time of the CodeCellRun or 0 if it's the (0, 0) of a code_cell
    pub(crate) fn code_cell_exists(&self, pos: Pos) -> Option<i64> {
        self.code_cell_sizes.iter().filter(|c| )
        if let Some(value) = self.code_cell_sizes.get(&pos) {
            return value.map(|(_, time)| *time);
        }
    }
}
