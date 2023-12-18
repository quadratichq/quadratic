use super::GridController;
use crate::grid::{Sheet, SheetId};

impl GridController {
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheets().iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheet(&self, sheet_id: SheetId) -> &Sheet {
        self.grid.sheet_from_id(sheet_id)
    }
}
