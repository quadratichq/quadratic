use serde::{Deserialize, Serialize};

use crate::{
    grid::{js_types::JsRenderCellUpdate, SheetId},
    Pos, Rect,
};

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

    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,

    pub operations: Vec<OperationSummary>,

    /// SheetOffsets that are modified.
    pub offsets_modified: Vec<SheetId>,

    /// Cursor location for undo/redo operation.
    pub cursor: Option<String>,
}
