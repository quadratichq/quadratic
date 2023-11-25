use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{grid::SheetId, SheetPos, SheetRect};

// keep this in sync with CellsTypes.ts
pub const CELL_SHEET_WIDTH: u32 = 20;
pub const CELL_SHEET_HEIGHT: u32 = 40;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct CellSheetsModified {
    sheet_id: String,
    x: i32,
    y: i32,
}

impl CellSheetsModified {
    pub fn new(sheet_pos: SheetPos) -> Self {
        let x = (sheet_pos.x as f64 / CELL_SHEET_WIDTH as f64).floor() as i32;
        let y = (sheet_pos.y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i32;
        Self {
            sheet_id: sheet_pos.sheet_id.to_string(),
            x,
            y,
        }
    }

    // todo: convert to SheetRect and improve modified rectangle calculation
    pub fn add_rect(
        cells_sheet_modified: &mut HashSet<CellSheetsModified>,
        sheet_rect: &SheetRect,
    ) {
        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                cells_sheet_modified.insert(Self::new(SheetPos {
                    x,
                    y,
                    sheet_id: sheet_rect.sheet_id,
                }));
            }
        }
    }
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

    /// CellSheet regions that need updating
    pub cell_sheets_modified: HashSet<CellSheetsModified>,

    /// SheetOffsets that are modified.
    pub offsets_modified: Vec<SheetId>,

    /// Cursor location for undo/redo operation.
    pub cursor: Option<String>,

    // should the grid trigger a save
    pub save: bool,

    // let TS know that the grid is already busy
    pub transaction_busy: bool,

    // should the grid generate a thumbnail
    pub generate_thumbnail: bool,
}

impl TransactionSummary {
    pub fn new(transaction_busy: bool) -> Self {
        TransactionSummary {
            transaction_busy,
            ..Default::default()
        }
    }

    pub fn clear(&mut self) {
        self.fill_sheets_modified.clear();
        self.border_sheets_modified.clear();
        self.code_cells_modified.clear();
        self.sheet_list_modified = false;
        self.cell_sheets_modified.clear();
        self.offsets_modified.clear();
        self.cursor = None;
        self.transaction_busy = false;
        self.generate_thumbnail = false;
        self.save = true;
    }
}
