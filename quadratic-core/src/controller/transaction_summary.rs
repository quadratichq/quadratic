use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{
    grid::{RegionRef, SheetId},
    Pos,
};

use super::GridController;

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
    pub fn new(sheet_id: SheetId, pos: Pos) -> Self {
        let x = (pos.x as f64 / CELL_SHEET_WIDTH as f64).floor() as i32;
        let y = (pos.y as f64 / CELL_SHEET_HEIGHT as f64).floor() as i32;
        Self {
            sheet_id: sheet_id.to_string(),
            x,
            y,
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

    // holds the operations to be shared via multiplayer
    pub forward_operations: Option<String>,

    // changes to html output
    pub html: HashSet<SheetId>,
}

impl TransactionSummary {
    pub fn new(transaction_busy: bool) -> Self {
        TransactionSummary {
            transaction_busy,
            ..Default::default()
        }
    }

    pub fn clear(&mut self, keep_forward_operations: bool) {
        self.fill_sheets_modified.clear();
        self.border_sheets_modified.clear();
        self.code_cells_modified.clear();
        self.sheet_list_modified = false;
        self.cell_sheets_modified.clear();
        self.offsets_modified.clear();
        self.cursor = None;
        self.transaction_busy = false;
        self.generate_thumbnail = false;
        self.save = false;
        if !keep_forward_operations {
            self.forward_operations = None;
        }
    }
}

impl GridController {
    pub fn add_cell_sheets_modified_region(&mut self, region: &RegionRef) {
        let mut modified = HashSet::new();
        let sheet = self.sheet(region.sheet);
        region.iter().for_each(|cell_ref| {
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                modified.insert(CellSheetsModified::new(sheet.id, pos));
            }
        });

        let summary = &mut self.summary;
        summary.cell_sheets_modified.extend(modified);
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, Rect};

    use super::*;

    #[test]
    fn test_cell_sheets_modified() {
        let sheet_id = SheetId::new();
        let cell_sheets_modified = CellSheetsModified::new(sheet_id, Pos { x: 0, y: 0 });
        assert_eq!(
            cell_sheets_modified,
            CellSheetsModified {
                sheet_id: sheet_id.to_string(),
                x: 0,
                y: 0
            }
        );
    }

    fn has_cell_sheet(
        cell_sheets_modified: &HashSet<CellSheetsModified>,
        sheet_id: SheetId,
        x: i32,
        y: i32,
    ) -> bool {
        cell_sheets_modified.iter().any(|modified| {
            print!(
                "{}: ({}, {}) == {}:  ({}, {})",
                modified.sheet_id,
                modified.x,
                modified.y,
                sheet_id.to_string(),
                x,
                y
            );
            modified.sheet_id == sheet_id.to_string() && modified.x == x && modified.y == y
        })
    }

    #[test]
    fn test_cell_sheets_modified_region() {
        let mut gc = GridController::new();
        let sheet_id = gc.grid().first_sheet_id().clone();
        let sheet = gc.grid_mut().first_sheet_mut();
        let (region, _) = sheet.region(Rect::from_numbers(0, 0, 21, 41));
        gc.add_cell_sheets_modified_region(&region);
        assert_eq!(gc.summary.cell_sheets_modified.len(), 4);
        assert!(has_cell_sheet(
            &gc.summary.cell_sheets_modified,
            sheet_id,
            0,
            0
        ));
        assert!(has_cell_sheet(
            &gc.summary.cell_sheets_modified,
            sheet_id,
            0,
            1
        ));
        assert!(has_cell_sheet(
            &gc.summary.cell_sheets_modified,
            sheet_id,
            1,
            0
        ));
        assert!(has_cell_sheet(
            &gc.summary.cell_sheets_modified,
            sheet_id,
            1,
            1
        ));
    }
}
