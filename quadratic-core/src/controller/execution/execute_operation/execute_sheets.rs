use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::{Sheet, SheetId},
};

impl GridController {
    pub(crate) fn execute_add_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::AddSheet { sheet } = op {
            let sheet_id = sheet.id;
            self.grid
                .add_sheet(Some(sheet.clone()))
                .expect("Unexpected duplicate sheet name in Operation::AddSheet");
            transaction.summary.sheet_list_modified = true;
            transaction.summary.html.insert(sheet_id);
            transaction
                .forward_operations
                .push(Operation::AddSheet { sheet });
            transaction
                .reverse_operations
                .insert(0, Operation::DeleteSheet { sheet_id });
        }
    }

    pub(crate) fn execute_delete_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::DeleteSheet { sheet_id } = op {
            let deleted_sheet = self.grid.remove_sheet(sheet_id);

            // create a sheet if we deleted the last one (only for user actions)
            if transaction.is_user() && self.sheet_ids().is_empty() {
                let new_first_sheet_id = SheetId::new();
                let name = String::from("Sheet 1");
                let order = self.grid.end_order();
                let new_first_sheet = Sheet::new(new_first_sheet_id, name, order);
                self.grid
                        .add_sheet(Some(new_first_sheet.clone()))
                        .expect("This should not throw an error as we just deleted the last sheet and therefore there can be no sheet name conflicts");
                transaction
                    .forward_operations
                    .push(Operation::DeleteSheet { sheet_id });
                transaction.forward_operations.push(Operation::AddSheet {
                    sheet: new_first_sheet,
                });
                transaction.reverse_operations.insert(
                    0,
                    Operation::AddSheet {
                        sheet: deleted_sheet,
                    },
                );
                transaction.reverse_operations.insert(
                    0,
                    Operation::DeleteSheet {
                        sheet_id: new_first_sheet_id,
                    },
                );
            } else {
                transaction
                    .forward_operations
                    .push(Operation::DeleteSheet { sheet_id });
                transaction.reverse_operations.insert(
                    0,
                    Operation::AddSheet {
                        sheet: deleted_sheet,
                    },
                );
            }
            transaction.summary.sheet_list_modified = true;
        }
    }

    pub(crate) fn execute_reorder_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ReorderSheet { target, order } = op {
            let old_first = self.grid.first_sheet_id();
            let Some(sheet) = self.try_sheet_mut(target) else {
                // sheet may have been deleted
                return;
            };
            sheet.order = order.clone();
            let original_order = sheet.order.clone();
            self.grid.move_sheet(target, order.clone());
            transaction.summary.sheet_list_modified = true;

            if old_first != self.grid.first_sheet_id() {
                transaction.summary.generate_thumbnail = true;
            }
            transaction
                .forward_operations
                .push(Operation::ReorderSheet { target, order });
            transaction.reverse_operations.insert(
                0,
                Operation::ReorderSheet {
                    target,
                    order: original_order,
                },
            );
        }
    }

    pub(crate) fn execute_set_sheet_name(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetSheetName { sheet_id, name } = op {
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };
            let old_name = sheet.name.clone();
            sheet.name = name.clone();
            transaction.summary.sheet_list_modified = true;
            transaction
                .forward_operations
                .push(Operation::SetSheetName { sheet_id, name });
            transaction.reverse_operations.insert(
                0,
                Operation::SetSheetName {
                    sheet_id,
                    name: old_name,
                },
            );
        }
    }

    pub(crate) fn execute_set_sheet_color(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetSheetColor { sheet_id, color } = op {
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };
            let old_color = sheet.color.clone();
            sheet.color = color.clone();
            transaction.summary.sheet_list_modified = true;
            transaction
                .forward_operations
                .push(Operation::SetSheetColor { sheet_id, color });
            transaction.reverse_operations.insert(
                0,
                Operation::SetSheetColor {
                    sheet_id,
                    color: old_color,
                },
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::GridController;

    #[test]
    fn test_add_sheet() {
        let mut gc = GridController::new();
        let summary = gc.add_sheet(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_delete_sheet() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.delete_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_execute_operation_set_sheet_name() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let name = "new name".to_string();
        let summary = gc.set_sheet_name(sheet_id, name.clone(), None);
        assert_eq!(gc.grid.sheets()[0].name, name);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].name, "Sheet 1".to_string());
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_set_sheet_color() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let color = Some("red".to_string());
        let summary = gc.set_sheet_color(sheet_id, color.clone(), None);
        assert_eq!(gc.grid.sheets()[0].color, color);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].color, None);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_sheet_reorder() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.add_sheet(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        let sheet_id2 = gc.sheet_ids()[1];
        let summary = gc.move_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        let summary = gc.move_sheet(sheet_id2, Some(sheet_id), None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);
        assert!(summary.save);
        assert!(summary.sheet_list_modified);
    }
}
