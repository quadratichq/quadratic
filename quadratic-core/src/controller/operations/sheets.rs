use itertools::Itertools;
use lexicon_fractional_index::key_between;

use crate::{
    controller::GridController,
    grid::{Sheet, SheetId},
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

    fn get_next_sheet_name(&self) -> String {
        let sheet_names = &self
            .grid
            .sheets()
            .iter()
            .map(|s| s.name.as_str())
            .collect_vec();
        util::unused_name("Sheet", sheet_names)
    }

    pub fn add_sheet_operations(&mut self) -> Vec<Operation> {
        let id = SheetId::new();
        let name = self.get_next_sheet_name();
        let order = self.grid.end_order();
        let sheet = Sheet::new(id, name, order);
        vec![Operation::AddSheet { sheet }]
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
        let Some(source) = self.try_sheet(sheet_id) else {
            // sheet no longer exists
            return vec![];
        };
        let mut new_sheet = source.clone();
        new_sheet.id = SheetId::new();
        new_sheet.name = format!("{} Copy", new_sheet.name);
        let right = self.grid.next_sheet(sheet_id);
        let right_order = right.map(|right| right.order.clone());
        new_sheet.order = key_between(&Some(source.order.clone()), &right_order).unwrap();

        vec![Operation::AddSheet { sheet: new_sheet }]
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
    fn test_get_sheet_next_name() {
        let mut gc = GridController::test();
        assert_eq!(gc.get_next_sheet_name(), "Sheet 2");
        gc.add_sheet(None);
        assert_eq!(gc.get_next_sheet_name(), "Sheet 3");
        gc.sheet_mut(gc.sheet_ids()[1]).name = "Sheet 2 modified".to_string();
        assert_eq!(gc.get_next_sheet_name(), "Sheet 2");
    }
}
