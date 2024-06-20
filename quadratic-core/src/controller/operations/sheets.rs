use itertools::Itertools;
use lexicon_fractional_index::key_between;

use crate::{
    controller::GridController,
    grid::{file::sheet_schema::export_sheet, Sheet, SheetId},
    util,
};

use super::operation::Operation;

impl GridController {
    pub fn set_sheet_name_operations(&mut self, sheet_id: SheetId, name: String) -> Vec<Operation> {
        vec![Operation::SetSheetName { sheet_id, name }]
    }

    pub fn set_sheet_color_operations(
        &mut self,
        sheet_id: SheetId,
        color: Option<String>,
    ) -> Vec<Operation> {
        vec![Operation::SetSheetColor { sheet_id, color }]
    }

    /// Returns all sheet names
    pub fn sheet_names(&self) -> Vec<&str> {
        self.grid.sheets().iter().map(|s| s.name.as_str()).collect()
    }

    fn get_next_sheet_name(&self) -> String {
        let sheet_names = &self
            .grid
            .sheets()
            .iter()
            .map(|s| s.name.as_str())
            .collect_vec();
        util::unused_name("Sheet", sheet_names)
    }

    pub fn add_sheet_operations(&mut self, name: Option<String>) -> Vec<Operation> {
        let id = SheetId::new();
        let name = name.unwrap_or_else(|| self.get_next_sheet_name());
        let order = self.grid.end_order();
        let sheet = Sheet::new(id, name, order);

        vec![Operation::AddSheetSchema {
            schema: export_sheet(&sheet),
        }]
    }

    pub fn delete_sheet_operations(&mut self, sheet_id: SheetId) -> Vec<Operation> {
        vec![Operation::DeleteSheet { sheet_id }]
    }

    pub fn move_sheet_operations(
        &mut self,
        sheet_id: SheetId,
        to_before: Option<SheetId>,
    ) -> Vec<Operation> {
        let to_before = if let Some(sheet_id) = to_before {
            self.grid.try_sheet(sheet_id)
        } else {
            None
        };

        let order = if let Some(to_before) = to_before {
            let before = self.grid.previous_sheet_order(to_before.id);
            key_between(&before, &Some(to_before.order.clone())).unwrap()
        } else {
            let last_order = self.grid.sheets().last().map(|last| last.order.clone());
            key_between(&last_order, &None).unwrap()
        };

        vec![Operation::ReorderSheet {
            target: sheet_id,
            order,
        }]
    }

    pub fn duplicate_sheet_operations(&mut self, sheet_id: SheetId) -> Vec<Operation> {
        let new_sheet_id = SheetId::new();
        vec![Operation::DuplicateSheet {
            sheet_id,
            new_sheet_id,
        }]
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_move_sheet_operation() {
        let mut gc = GridController::test();
        gc.add_sheet(None);
        gc.add_sheet(None);

        // 1, 2, 3
        let sheet_ids = gc.sheet_ids();

        let ops = gc.move_sheet_operations(sheet_ids[0], Some(sheet_ids[1]));
        assert_eq!(ops.len(), 1);
        if let Operation::ReorderSheet { target, order } = &ops[0] {
            assert_eq!(target, &sheet_ids[0]);
            let key = key_between(
                &Some(gc.sheet_index(0).order.clone()),
                &Some(gc.sheet_index(1).order.clone()),
            )
            .unwrap();
            assert_eq!(order, &key);
        } else {
            panic!("wrong operation type");
        }

        // 2, 1, 3
        let ops = gc.move_sheet_operations(sheet_ids[2], Some(sheet_ids[0]));
        assert_eq!(ops.len(), 1);
        if let Operation::ReorderSheet { target, order } = &ops[0] {
            assert_eq!(target, &sheet_ids[2]);
            let key = key_between(&None, &Some(gc.sheet_index(0).order.clone())).unwrap();
            assert_eq!(order, &key);
        } else {
            panic!("wrong operation type");
        }

        // 1, 3, 2
        let ops = gc.move_sheet_operations(sheet_ids[1], None);
        assert_eq!(ops.len(), 1);
        if let Operation::ReorderSheet { target, order } = &ops[0] {
            assert_eq!(target, &sheet_ids[1]);
            let key = key_between(&Some(gc.sheet_index(2).order.clone()), &None).unwrap();
            assert_eq!(order, &key);
        } else {
            panic!("wrong operation type");
        }
    }

    #[test]
    fn get_sheet_next_name() {
        // Sheet 1
        let mut gc = GridController::test();
        gc.add_sheet(None);
        // Sheet 1 | Sheet 2
        assert_eq!(gc.sheet_index(1).name, "Sheet 2");
        gc.sheet_mut(gc.sheet_ids()[1]).name = "Sheet 2 modified".to_string();
        // Sheet 1 | Sheet 2 modified
        gc.add_sheet(None);
        // Sheet 1 | Sheet 2 modified | Sheet 2
        assert_eq!(gc.sheet_index(2).name, "Sheet 2");
        gc.delete_sheet(gc.sheet_ids()[0], None);
        // Sheet 2 modified | Sheet 2
        gc.add_sheet(None);
        // Sheet 2 modified | Sheet 2 | Sheet 3
        assert_eq!(gc.sheet_index(2).name, "Sheet 3");
    }

    #[test]
    fn sheet_names() {
        let mut gc = GridController::test();
        gc.add_sheet(None);
        gc.add_sheet(None);
        assert_eq!(gc.sheet_names(), vec!["Sheet 1", "Sheet 2", "Sheet 3"]);
    }
}
