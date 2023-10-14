use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::grid::{js_types::JsRenderCellUpdate, SheetId};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub enum OperationSummary {
    SetCellValues(String, Vec<JsRenderCellUpdate>),
    SetCellFormats(String, Vec<JsRenderCellUpdate>),
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    /// Sheets where any fills have been modified.
    pub fill_sheets_modified: Vec<SheetId>,

    /// Sheets where any borders have been modified.
    pub border_sheets_modified: Vec<SheetId>,

    /// Sheets where code_cell arrays have been modified.
    pub code_cells_modified: HashSet<SheetId>,

    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,

    pub operations: Vec<OperationSummary>,

    /// SheetOffsets that are modified.
    pub offsets_modified: Vec<SheetId>,

    /// Cursor location for undo/redo operation.
    pub cursor: Option<String>,
}

impl TransactionSummary {
    pub fn clear(&mut self) {
        self.fill_sheets_modified.clear();
        self.border_sheets_modified.clear();
        self.code_cells_modified.clear();
        self.sheet_list_modified = false;
        self.operations.clear();
        self.offsets_modified.clear();
        self.cursor = None;
    }
}
