use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{error_core::CoreError, grid::SheetId, SheetPos, SheetRect};

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
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    /// Sheets where any fills have been modified.
    pub fill_sheets_modified: HashSet<SheetId>,

    /// Sheets where any borders have been modified.
    pub border_sheets_modified: HashSet<SheetId>,

    /// Sheets where code_cell arrays have been modified.
    pub code_cells_modified: HashSet<SheetId>,

    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,

    /// CellSheet regions that need updating
    pub cell_sheets_modified: HashSet<CellSheetsModified>,

    /// SheetOffsets that are modified.
    pub offsets_modified: HashSet<SheetId>,

    /// Cursor location for undo/redo operation.
    pub cursor: Option<String>,

    // should the grid trigger a save
    pub save: bool,

    // should the grid generate a thumbnail
    pub generate_thumbnail: bool,

    // Transaction to be shared via multiplayer
    pub transaction_id: Option<String>,
    pub operations: Option<String>,

    // changes to html output
    pub html: HashSet<SheetId>,

    // indicates the client should request transactions from the server starting from this sequence_num
    pub request_transactions: Option<u64>,

    // pass error to client for TS handling
    pub error: Option<CoreError>,
}

impl TransactionSummary {
    pub fn error(error: CoreError) -> Self {
        TransactionSummary {
            error: Some(error),
            ..Default::default()
        }
    }

    pub fn cursor(cursor: Option<String>) -> Self {
        TransactionSummary {
            cursor,
            ..Default::default()
        }
    }

    pub fn clear(&mut self, keep_forward_transaction: bool) {
        self.fill_sheets_modified.clear();
        self.border_sheets_modified.clear();
        self.code_cells_modified.clear();
        self.sheet_list_modified = false;
        self.cell_sheets_modified.clear();
        self.offsets_modified.clear();
        self.cursor = None;
        self.generate_thumbnail = false;
        self.save = false;
        if !keep_forward_transaction {
            self.operations = None;
        }
    }

    /// Merge another TransactionSummary into this one. This does not merge transaction_id, operations, or request_transaction.
    pub fn merge(&mut self, summary: &TransactionSummary) {
        self.fill_sheets_modified
            .extend(summary.fill_sheets_modified.iter().cloned());
        self.border_sheets_modified
            .extend(summary.border_sheets_modified.iter().cloned());
        self.code_cells_modified
            .extend(summary.code_cells_modified.iter().cloned());
        self.sheet_list_modified |= summary.sheet_list_modified;
        self.cell_sheets_modified
            .extend(summary.cell_sheets_modified.iter().cloned());
        self.offsets_modified
            .extend(summary.offsets_modified.iter().cloned());
        self.generate_thumbnail |= summary.generate_thumbnail;
    }

    /// Adds a CellSheetsModified region to the summary based on a sheet_rect.
    pub fn add_cell_sheets_modified_rect(&mut self, sheet_rect: &SheetRect) {
        let mut modified = HashSet::new();
        for y in sheet_rect.y_range() {
            for x in sheet_rect.x_range() {
                let sheet_pos = SheetPos {
                    x,
                    y,
                    sheet_id: sheet_rect.sheet_id,
                };
                modified.insert(CellSheetsModified::new(sheet_pos));
            }
        }
        self.cell_sheets_modified.extend(modified);
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_cell_sheets_modified() {
        let sheet_id = SheetId::new();
        let cell_sheets_modified = CellSheetsModified::new(SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        });
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
                modified.sheet_id, modified.x, modified.y, sheet_id, x, y
            );
            modified.sheet_id == sheet_id.to_string() && modified.x == x && modified.y == y
        })
    }

    #[test]
    fn test_cell_sheets_modified_region() {
        let mut summary = TransactionSummary::default();
        let sheet_id = SheetId::new();
        let sheet_rect = Rect::from_numbers(0, 0, 21, 41).to_sheet_rect(sheet_id);
        summary.add_cell_sheets_modified_rect(&sheet_rect);
        assert_eq!(summary.cell_sheets_modified.len(), 4);
        assert!(has_cell_sheet(
            &summary.cell_sheets_modified,
            sheet_id,
            0,
            0
        ));
        assert!(has_cell_sheet(
            &summary.cell_sheets_modified,
            sheet_id,
            0,
            1
        ));
        assert!(has_cell_sheet(
            &summary.cell_sheets_modified,
            sheet_id,
            1,
            0
        ));
        assert!(has_cell_sheet(
            &summary.cell_sheets_modified,
            sheet_id,
            1,
            1
        ));
    }
}
