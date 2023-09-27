use itertools::Itertools;
use lexicon_fractional_index::key_between;

use crate::grid::{Sheet, SheetId};

use super::{operations::Operation, transactions::TransactionSummary, GridController};

impl GridController {
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheets().iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheet(&self, sheet_id: SheetId) -> &Sheet {
        self.grid.sheet_from_id(sheet_id)
    }

    pub async fn set_sheet_name(
        &mut self,
        sheet_id: SheetId,
        name: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        self.transact_forward(vec![Operation::SetSheetName { sheet_id, name }], cursor)
            .await
    }

    pub async fn set_sheet_color(
        &mut self,
        sheet_id: SheetId,
        color: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        self.transact_forward(vec![Operation::SetSheetColor { sheet_id, color }], cursor)
            .await
    }

    pub async fn add_sheet(&mut self, cursor: Option<String>) -> TransactionSummary {
        let sheet_names = &self
            .grid
            .sheets()
            .iter()
            .map(|s| s.name.as_str())
            .collect_vec();

        let id = SheetId::new();
        let name = crate::util::unused_name("Sheet", &sheet_names);
        let order = self.grid.end_order();
        let sheet = Sheet::new(id, name, order);
        let ops = vec![Operation::AddSheet { sheet }];
        self.transact_forward(ops, cursor).await
    }
    pub async fn delete_sheet(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let mut ops = vec![Operation::DeleteSheet { sheet_id }];
        if self.sheet_ids().len() == 1 {
            let id = SheetId::new();
            let name = String::from("Sheet 1");
            let order = self.grid.end_order();
            let sheet = Sheet::new(id, name, order);
            ops.push(Operation::AddSheet { sheet });
        }
        self.transact_forward(ops, cursor).await
    }
    pub async fn move_sheet(
        &mut self,
        sheet_id: SheetId,
        to_before: Option<SheetId>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let order: String;
        // treat to_before as None if to_before's sheet no longer exists
        if to_before.is_none() || !self.grid.sheet_has_id(to_before) {
            let last_order = match self.grid.sheets().last() {
                Some(last) => Some(last.order.clone()),
                None => None,
            };
            order = key_between(&last_order, &None).unwrap();
        } else {
            let after_sheet = self.grid.sheet_from_id(to_before.unwrap());
            let before = self.grid.previous_sheet_order(after_sheet.id);
            order = key_between(&before, &Some(after_sheet.order.clone())).unwrap();
        }
        let ops = vec![Operation::ReorderSheet {
            target: sheet_id,
            order,
        }];
        self.transact_forward(ops, cursor).await
    }
    pub async fn duplicate_sheet(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let source = self.grid.sheet_from_id(sheet_id);
        let mut new_sheet = self.sheet(sheet_id).clone();
        new_sheet.id = SheetId::new();
        new_sheet.name = format!("{} Copy", new_sheet.name);
        let right = self.grid.next_sheet(sheet_id);
        let right_order = right.map(|right| right.order.clone());
        new_sheet.order = key_between(&Some(source.order.clone()), &right_order).unwrap();
        let ops = vec![Operation::AddSheet { sheet: new_sheet }];
        self.transact_forward(ops, cursor).await
    }
}

#[test]
fn test_add_delete_reorder_sheets() {
    let mut g = GridController::new();
    g.add_sheet(None);
    g.add_sheet(None);
    let old_sheet_ids = g.sheet_ids();
    let s1 = old_sheet_ids[0];
    let s2 = old_sheet_ids[1];
    let s3 = old_sheet_ids[2];

    let mut test_reorder = |a, b, expected: [SheetId; 3]| {
        g.move_sheet(a, b, None);
        assert_eq!(expected.to_vec(), g.sheet_ids());
        g.undo(None);
        assert_eq!(old_sheet_ids, g.sheet_ids());
    };

    test_reorder(s1, Some(s2), [s1, s2, s3]);
    test_reorder(s1, Some(s3), [s2, s1, s3]);
    test_reorder(s1, None, [s2, s3, s1]);
    test_reorder(s2, Some(s1), [s2, s1, s3]);
    test_reorder(s2, Some(s3), [s1, s2, s3]);
    test_reorder(s2, None, [s1, s3, s2]);
    test_reorder(s3, Some(s1), [s3, s1, s2]);
    test_reorder(s3, Some(s2), [s1, s3, s2]);
    test_reorder(s3, None, [s1, s2, s3]);

    let mut test_delete = |a, expected: [SheetId; 2]| {
        g.delete_sheet(a, None);
        assert_eq!(expected.to_vec(), g.sheet_ids());
        g.undo(None);
        assert_eq!(old_sheet_ids, g.sheet_ids());
    };

    test_delete(s1, [s2, s3]);
    test_delete(s2, [s1, s3]);
    test_delete(s3, [s1, s2]);
}

#[cfg(test)]
mod test {
    use crate::controller::GridController;

    #[test]
    fn test_duplicate_sheet() {
        let mut g = GridController::new();
        let old_sheet_ids = g.sheet_ids();
        let s1 = old_sheet_ids[0];

        g.set_sheet_name(s1, String::from("Nice Name"), None);
        g.duplicate_sheet(s1, None);
        let sheet_ids = g.sheet_ids();
        let s2 = sheet_ids[1];

        let sheet1 = g.sheet(s1);
        let sheet2 = g.sheet(s2);

        assert_eq!(sheet2.name, format!("{} Copy", sheet1.name));
    }

    #[actix_rt::test]
    async fn test_delete_last_sheet() {
        let mut g = GridController::new();
        let sheet_ids = g.sheet_ids();
        let first_sheet_id = sheet_ids[0].clone();

        g.delete_sheet(first_sheet_id, None).await;
        let new_sheet_ids = g.sheet_ids();
        assert_eq!(new_sheet_ids.len(), 1);
        assert_ne!(new_sheet_ids[0], sheet_ids[0]);

        g.undo(None);
        let new_sheet_ids_2 = g.sheet_ids();
        assert_eq!(sheet_ids[0], new_sheet_ids_2[0]);

        g.redo(None);
        let new_sheet_ids_3 = g.sheet_ids();
        assert_eq!(new_sheet_ids[0], new_sheet_ids_3[0]);
    }
}
