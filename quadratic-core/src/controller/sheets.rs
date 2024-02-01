use super::GridController;
use crate::grid::Sheet;
use crate::grid::SheetId;

impl GridController {
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheets().iter().map(|sheet| sheet.id).collect()
    }

    pub fn try_sheet(&self, sheet_id: SheetId) -> Option<&Sheet> {
        self.grid.try_sheet(sheet_id)
    }

    pub fn try_sheet_mut(&mut self, sheet_id: SheetId) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut(sheet_id)
    }

    pub fn try_sheet_from_name(&mut self, name: String) -> Option<&Sheet> {
        self.grid.try_sheet_from_name(name)
    }

    pub fn try_sheet_mut_from_name(&mut self, name: String) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut_from_name(name)
    }

    pub fn try_sheet_from_string_id(&self, id: String) -> Option<&Sheet> {
        self.grid.try_sheet_from_string_id(id)
    }

    pub fn try_sheet_mut_from_string_id(&mut self, id: String) -> Option<&mut Sheet> {
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
    use crate::{controller::GridController, grid::SheetId};

    #[test]
    fn test_sheet_ids() {
        let mut gc = super::GridController::test();
        let sheet_ids = gc.sheet_ids();
        assert_eq!(sheet_ids.len(), 1);
        let sheet_id = sheet_ids[0];
        assert_eq!(gc.sheet(sheet_id).name, "Sheet 1");

        gc.add_sheet(None);
        let sheet_ids = gc.sheet_ids();
        assert_eq!(sheet_ids.len(), 2);
        let sheet_id = sheet_ids[1];
        assert_eq!(gc.sheet(sheet_id).name, "Sheet 2");
    }

    #[test]
    fn test_try_sheet_from_id() {
        let mut gc = super::GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert_eq!(gc.try_sheet(sheet_id).unwrap().name, "Sheet 1");

        gc.add_sheet(None);
        let sheet_id = gc.sheet_ids()[1];
        assert_eq!(gc.try_sheet(sheet_id).unwrap().name, "Sheet 2");

        let sheet_id = SheetId::new();
        assert_eq!(gc.try_sheet(sheet_id), None);
    }

    #[test]
    fn test_try_sheet_mut_from_id() {
        let mut gc = super::GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.try_sheet_mut(sheet_id).unwrap().name = "Sheet 1 modified".to_string();

        gc.add_sheet(None);
        let sheet_id_2 = gc.sheet_ids()[1];
        gc.try_sheet_mut(sheet_id_2).unwrap().name = "Sheet 2 modified".to_string();

        let new_sheet_id = SheetId::new();
        assert_eq!(gc.try_sheet_mut(new_sheet_id), None);

        assert_eq!(gc.sheet(sheet_id).name, "Sheet 1 modified");
        assert_eq!(gc.sheet(sheet_id_2).name, "Sheet 2 modified");
    }

    #[test]
    fn test_try_sheet_from_name() {
        let mut gc = super::GridController::test();
        assert_eq!(
            gc.try_sheet_from_name("Sheet 1".to_string()).unwrap().name,
            "Sheet 1"
        );

        gc.add_sheet(None);
        assert_eq!(
            gc.try_sheet_from_name("Sheet 2".to_string()).unwrap().name,
            "Sheet 2"
        );

        assert_eq!(gc.try_sheet_from_name("Sheet 3".to_string()), None);
    }

    #[test]
    fn test_try_sheet_mut_from_name() {
        let mut gc = GridController::test();
        gc.add_sheet(None);

        gc.try_sheet_mut_from_name("Sheet 1".to_string())
            .unwrap()
            .name = "Sheet 1 modified".to_string();

        gc.try_sheet_mut_from_name("Sheet 2".to_string())
            .unwrap()
            .name = "Sheet 2 modified".to_string();

        let sheet_ids = gc.sheet_ids();
        assert_eq!(gc.sheet(sheet_ids[0]).name, "Sheet 1 modified");
        assert_eq!(gc.sheet(sheet_ids[1]).name, "Sheet 2 modified");
    }

    #[test]
    fn test_try_sheet_from_string_id() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert_eq!(
            gc.try_sheet_from_string_id(sheet_id.to_string())
                .unwrap()
                .name,
            "Sheet 1"
        );
        assert_eq!(gc.try_sheet_from_string_id("not found".to_string()), None);
    }
}
