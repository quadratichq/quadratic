use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::{
    grid::{js_types::JsRenderCellUpdate, SheetId},
    Pos, Rect,
};

use super::transactions::CellHash;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    /// Cell value regions modified.
    pub cell_value_regions_modified: Vec<(SheetId, Rect)>,

    /// Cell and text formatting regions modified.
    pub cell_regions_modified: Vec<(SheetId, Rect)>,

    /// Sheets where any fills have been modified.
    pub fill_sheets_modified: Vec<SheetId>,

    /// Sheets where any borders have been modified.
    pub border_sheets_modified: Vec<SheetId>,

    /// Locations of code cells that were modified. They may no longer exist.
    pub code_cells_modified: Vec<(SheetId, Pos)>,

    /// CellHash blocks of affected cell values and formats
    pub cell_hash_values_modified: BTreeMap<String, BTreeMap<String, Vec<JsRenderCellUpdate>>>,

    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,

    /// SheetOffsets that are modified.
    pub offsets_modified: Vec<SheetId>,

    /// Cursor location for undo/redo operation.
    pub cursor: Option<String>,
}

impl TransactionSummary {
    pub fn add_js_render_cell_update(&mut self, sheet_id: SheetId, update: JsRenderCellUpdate) {
        let sheet = self
            .cell_hash_values_modified
            .entry(sheet_id.to_string())
            .or_default();
        let cell_hash = CellHash::from(Pos::from((update.x, update.y)));

        sheet
            .entry(cell_hash.get().to_owned())
            .or_default()
            .push(update);
    }
}
