use itertools::Itertools;
use lexicon_fractional_index::key_between;

use crate::{
    controller::GridController,
    grid::{Sheet, SheetId},
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

    pub fn add_sheet_operations(&mut self) -> Vec<Operation> {
        let sheet_names = &self
            .grid
            .sheets()
            .iter()
            .map(|s| s.name.as_str())
            .collect_vec();

        let id = SheetId::new();
        let name = crate::util::unused_name("Sheet", sheet_names);
        let order = self.grid.end_order();
        let sheet = Sheet::new(id, name, order);
        vec![Operation::AddSheet { sheet }]
    }

    pub fn delete_sheet_operations(&mut self, sheet_id: SheetId) -> Vec<Operation> {
        vec![Operation::DeleteSheet { sheet_id }]
    }

    // todo: make sure this is fully tested
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
