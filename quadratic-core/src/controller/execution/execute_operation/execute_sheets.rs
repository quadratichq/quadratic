use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::{Sheet, SheetId},
    wasm_bindings::controller::sheet_info::SheetInfo,
};

impl GridController {
    pub(crate) fn execute_add_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::AddSheet { sheet } = op {
            let sheet_id = sheet.id;
            if self.grid.try_sheet(sheet_id).is_some() {
                // sheet already exists (unlikely but possible if this operation is run twice)
                return;
            }
            let sheet_id = self.grid.add_sheet(Some(sheet.clone()));

            if cfg!(target_family = "wasm") || cfg!(test) {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    let sheet_info = SheetInfo::from(sheet);
                    if let Ok(sheet_info) = serde_json::to_string(&sheet_info) {
                        crate::wasm_bindings::js::jsAddSheet(sheet_info, transaction.is_user());
                    }
                }
            }

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
            let Some(deleted_sheet) = self.grid.remove_sheet(sheet_id) else {
                // sheet was already deleted
                return;
            };

            // create a sheet if we deleted the last one (only for user actions)
            if transaction.is_user() && self.sheet_ids().is_empty() {
                let new_first_sheet_id = SheetId::new();
                let name = String::from("Sheet 1");
                let order = self.grid.end_order();
                let new_first_sheet = Sheet::new(new_first_sheet_id, name, order);
                self.grid.add_sheet(Some(new_first_sheet.clone()));
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

                // if that's the last sheet, then we created a new one and we have to let the workers know
                if cfg!(target_family = "wasm") {
                    if let Some(sheet) = self.try_sheet(new_first_sheet_id) {
                        let sheet_info = SheetInfo::from(sheet);
                        if let Ok(sheet_info) = serde_json::to_string(&sheet_info) {
                            crate::wasm_bindings::js::jsAddSheet(sheet_info, transaction.is_user());
                        }
                    }
                }
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

                // otherwise we need to send the deleted sheet information to the workers
                if cfg!(target_family = "wasm") || cfg!(test) {
                    crate::wasm_bindings::js::jsDeleteSheet(
                        sheet_id.to_string(),
                        transaction.is_user(),
                    );
                }
            }
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
            let original_order = sheet.order.clone();
            sheet.order = order.clone();
            self.grid.move_sheet(target, order.clone());

            if old_first != self.grid.first_sheet_id() {
                transaction.generate_thumbnail = true;
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

            if cfg!(target_family = "wasm") {
                if let Some(sheet) = self.try_sheet(target) {
                    if let Ok(sheet_info) = serde_json::to_string(&SheetInfo::from(sheet)) {
                        crate::wasm_bindings::js::jsSheetInfoUpdate(sheet_info);
                    }
                }
            }
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

            if cfg!(target_family = "wasm") {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let Ok(sheet_info) = serde_json::to_string(&SheetInfo::from(sheet)) {
                        crate::wasm_bindings::js::jsSheetInfoUpdate(sheet_info);
                    }
                }
            }
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

            if cfg!(target_family = "wasm") {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let Ok(sheet_info) = serde_json::to_string(&SheetInfo::from(sheet)) {
                        crate::wasm_bindings::js::jsSheetInfoUpdate(sheet_info);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::GridController;

    #[test]
    fn test_add_sheet() {
        let mut gc = GridController::test();
        gc.add_sheet(None);
        assert_eq!(gc.grid.sheets().len(), 2);

        // was jsAdSheet called with the right stuff
        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
    }

    #[test]
    fn test_delete_sheet() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.delete_sheet(sheet_id, None);
        assert_eq!(gc.grid.sheets().len(), 1);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_execute_operation_set_sheet_name() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let name = "new name".to_string();
        gc.set_sheet_name(sheet_id, name.clone(), None);
        assert_eq!(gc.grid.sheets()[0].name, name);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].name, "Sheet 1".to_string());

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_set_sheet_color() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let color = Some("red".to_string());
        gc.set_sheet_color(sheet_id, color.clone(), None);
        assert_eq!(gc.grid.sheets()[0].color, color);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);

        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].color, None);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);
    }

    #[test]
    fn test_sheet_reorder() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Sheet 1, Sheet 2
        gc.add_sheet(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        let sheet_id2 = gc.sheet_ids()[1];
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);

        // Sheet 2, Sheet 1
        gc.move_sheet(sheet_id, None, None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);

        // Sheet 1, Sheet 2
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);

        gc.move_sheet(sheet_id2, Some(sheet_id), None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);

        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);

        // todo: figure out a way to test the js functions
        // assert!(summary.sheet_list_modified);
    }
}
