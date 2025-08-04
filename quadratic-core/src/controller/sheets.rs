use super::GridController;
use crate::grid::Sheet;
use crate::grid::SheetId;

use anyhow::{Result, anyhow};

impl GridController {
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheet_ids()
    }

    pub fn sheets(&self) -> Vec<&Sheet> {
        self.grid.sheets().values().collect()
    }

    pub fn try_sheet(&self, sheet_id: SheetId) -> Option<&Sheet> {
        self.grid.try_sheet(sheet_id)
    }

    pub fn try_sheet_result(&self, sheet_id: SheetId) -> Result<&Sheet> {
        self.grid
            .try_sheet(sheet_id)
            .ok_or_else(|| anyhow!("Sheet with id {:?} not found", sheet_id))
    }

    pub fn try_sheet_mut(&mut self, sheet_id: SheetId) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut(sheet_id)
    }

    pub fn try_sheet_mut_result(&mut self, sheet_id: SheetId) -> Result<&mut Sheet> {
        self.try_sheet_mut(sheet_id)
            .ok_or_else(|| anyhow!("Sheet with id {:?} not found", sheet_id))
    }

    pub fn try_sheet_from_name(&mut self, name: &str) -> Option<&Sheet> {
        self.grid.try_sheet_from_name(name)
    }

    pub fn try_sheet_mut_from_name(&mut self, name: &str) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut_from_name(name)
    }

    pub fn try_sheet_from_string_id(&self, id: &str) -> Option<&Sheet> {
        self.grid.try_sheet_from_string_id(id)
    }

    pub fn try_sheet_mut_from_string_id(&mut self, id: &str) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut_from_string_id(id)
    }

    #[cfg(test)]
    pub fn sheet(&self, sheet_id: SheetId) -> &Sheet {
        self.try_sheet(sheet_id).unwrap()
    }

    #[cfg(test)]
    pub fn sheet_index(&self, index: usize) -> &Sheet {
        &self.grid.sheets()[index]
    }

    #[cfg(test)]
    pub fn sheet_mut(&mut self, sheet_id: SheetId) -> &mut Sheet {
        self.try_sheet_mut(sheet_id).unwrap()
    }
}

#[cfg(test)]
mod test {
    use crate::{constants::SHEET_NAME, controller::GridController, grid::SheetId};

    #[test]
    fn test_sheet_ids() {
        let mut gc = super::GridController::test();
        let sheet_ids = gc.sheet_ids();
        assert_eq!(sheet_ids.len(), 1);
        let sheet_id = sheet_ids[0];
        assert_eq!(gc.sheet(sheet_id).name, SHEET_NAME.to_owned() + "1");

        gc.add_sheet(None, None, None, false);
        let sheet_ids = gc.sheet_ids();
        assert_eq!(sheet_ids.len(), 2);
        let sheet_id = sheet_ids[1];
        assert_eq!(gc.sheet(sheet_id).name, "Sheet 2");
    }

    #[test]
    fn test_try_sheet_from_id() {
        let mut gc = super::GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert_eq!(
            gc.try_sheet(sheet_id).unwrap().name,
            SHEET_NAME.to_owned() + "1"
        );

        gc.add_sheet(None, None, None, false);
        let sheet_id = gc.sheet_ids()[1];
        assert_eq!(
            gc.try_sheet(sheet_id).unwrap().name,
            SHEET_NAME.to_owned() + "2"
        );

        let sheet_id = SheetId::new();
        assert_eq!(gc.try_sheet(sheet_id), None);
    }

    #[test]
    fn test_try_sheet_mut_from_id() {
        let mut gc = super::GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.try_sheet_mut(sheet_id).unwrap().name = "Sheet1 modified".to_string();

        gc.add_sheet(None, None, None, false);
        let sheet_id_2 = gc.sheet_ids()[1];
        gc.try_sheet_mut(sheet_id_2).unwrap().name = "Sheet 2 modified".to_string();

        let new_sheet_id = SheetId::new();
        assert_eq!(gc.try_sheet_mut(new_sheet_id), None);

        assert_eq!(gc.sheet(sheet_id).name, "Sheet1 modified");
        assert_eq!(gc.sheet(sheet_id_2).name, "Sheet 2 modified");
    }

    #[test]
    fn test_try_sheet_from_name() {
        let mut gc = super::GridController::test();
        assert_eq!(
            gc.try_sheet_from_name(&format!("{SHEET_NAME}1"))
                .unwrap()
                .name,
            SHEET_NAME.to_owned() + "1"
        );

        gc.add_sheet(None, None, None, false);
        assert_eq!(
            gc.try_sheet_from_name(&format!("{SHEET_NAME}2"))
                .unwrap()
                .name,
            SHEET_NAME.to_owned() + "2"
        );

        assert_eq!(gc.try_sheet_from_name(&format!("{SHEET_NAME}3")), None);
    }

    #[test]
    fn test_try_sheet_mut_from_name() {
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);

        gc.try_sheet_mut_from_name(&format!("{SHEET_NAME}1"))
            .unwrap()
            .name = format!("{SHEET_NAME}1 modified");

        gc.try_sheet_mut_from_name(&format!("{SHEET_NAME}2"))
            .unwrap()
            .name = format!("{SHEET_NAME}2 modified");

        let sheet_ids = gc.sheet_ids();
        assert_eq!(
            gc.sheet(sheet_ids[0]).name,
            format!("{SHEET_NAME}1 modified")
        );
        assert_eq!(
            gc.sheet(sheet_ids[1]).name,
            format!("{SHEET_NAME}2 modified")
        );
    }

    #[test]
    fn test_try_sheet_from_string_id() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert_eq!(
            gc.try_sheet_from_string_id(&sheet_id.to_string())
                .unwrap()
                .name,
            format!("{SHEET_NAME}1")
        );
        assert_eq!(gc.try_sheet_from_string_id("not found"), None);
    }
}
