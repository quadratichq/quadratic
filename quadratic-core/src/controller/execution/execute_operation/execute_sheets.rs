use crate::{
    constants::SHEET_NAME,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{
        Sheet, SheetId, file::sheet_schema::export_sheet, js_types::JsSnackbarSeverity,
        unique_data_table_name,
    },
};
use anyhow::{Result, bail};
use lexicon_fractional_index::key_between;

impl GridController {
    fn handle_add_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet: Sheet,
    ) -> Result<()> {
        let sheet_id = self.grid.add_sheet(Some(sheet));
        self.send_add_sheet(transaction, sheet_id);

        let mut context = self.a1_context().to_owned();

        let sheet = self.try_sheet_result(sheet_id)?;

        let data_tables_pos = sheet
            .data_tables
            .expensive_iter_with_sub_tables()
            .map(|(p, _)| p)
            .collect::<Vec<_>>();
        let mut table_names_to_update_in_cell_ref = vec![];

        // update table names in data tables in the new sheet
        let sheet = self.try_sheet_mut_result(sheet_id)?;
        for multi_pos in data_tables_pos.iter() {
            transaction.add_code_cell(multi_pos.to_multi_sheet_pos(sheet_id));

            sheet.modify_data_table_at(multi_pos, |data_table| {
                let old_name = data_table.name().to_string();
                let unique_name = unique_data_table_name(&old_name, false, None, &context);
                if old_name != unique_name {
                    data_table.name = unique_name.to_owned().into();

                    // update table context for replacing table names in code cells
                    if let Some(old_table_map_entry) = context.table_map.try_table(&old_name) {
                        let mut new_table_map_entry = old_table_map_entry.to_owned();
                        new_table_map_entry.multi_sheet_pos.sheet_id = sheet_id;
                        new_table_map_entry.table_name = unique_name.to_owned();
                        context.table_map.insert(new_table_map_entry);
                    }

                    table_names_to_update_in_cell_ref.push((old_name, unique_name));
                }

                Ok(())
            })?;
        }

        // update table names references in code cells in the new sheet
        for (old_name, unique_name) in table_names_to_update_in_cell_ref.into_iter() {
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            for multi_pos in data_tables_pos.iter() {
                // Extract sheet_pos before mutable borrow
                let sheet_pos = multi_pos.to_sheet_pos(sheet);

                if let Some(code_cell_value) = sheet
                    .cell_value_mut(multi_pos)
                    .and_then(|cv| cv.code_cell_value_mut())
                    && let Some(sheet_pos) = sheet_pos
                {
                    code_cell_value.replace_table_name_in_cell_references(
                        &context,
                        sheet_pos.sheet_id,
                        &old_name,
                        &unique_name,
                    );
                }
            }
        }

        if transaction.is_user_ai_undo_redo() {
            transaction.add_fill_cells(sheet_id);
            transaction.sheet_borders.insert(sheet_id);
            transaction
                .reverse_operations
                .push(Operation::DeleteSheet { sheet_id });
        }

        Ok(())
    }

    pub(crate) fn execute_add_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::AddSheet { sheet } = op {
            let sheet_id = sheet.id;
            if self.grid.try_sheet(sheet_id).is_some() {
                // sheet already exists (unlikely but possible if this operation is run twice)
                return Ok(());
            }

            // clone only for user/undo/redo transactions
            let forward_sheet = if transaction.is_user_ai_undo_redo() {
                Some(sheet.clone())
            } else {
                None
            };

            self.handle_add_sheet(transaction, *sheet)?;

            if let Some(forward_sheet) = forward_sheet {
                transaction
                    .forward_operations
                    .push(Operation::AddSheetSchema {
                        schema: Box::new(export_sheet(*forward_sheet)),
                    });
            }
        }

        Ok(())
    }

    pub(crate) fn execute_add_sheet_schema(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::AddSheetSchema { schema } = op {
            // clone only for user/undo/redo transactions
            let forward_schema = if transaction.is_user_ai_undo_redo() {
                Some(schema.clone())
            } else {
                None
            };

            if let Ok(sheet) = schema.into_latest() {
                if self.grid.try_sheet(sheet.id).is_some() {
                    // sheet already exists (unlikely but possible if this operation is run twice)
                    return Ok(());
                }

                self.handle_add_sheet(transaction, sheet)?;
            }

            if let Some(schema) = forward_schema {
                transaction
                    .forward_operations
                    .push(Operation::AddSheetSchema { schema });
            }
        }

        Ok(())
    }

    pub(crate) fn execute_delete_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::DeleteSheet { sheet_id } = op {
            // get code run operations for the sheet
            let code_run_ops = self.rerun_sheet_code_cells_operations(sheet_id);

            let Some(deleted_sheet) = self.grid.remove_sheet(sheet_id) else {
                // sheet was already deleted
                return;
            };

            if transaction.is_user_ai_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::DeleteSheet { sheet_id });

                for op in code_run_ops {
                    transaction.reverse_operations.push(op);
                }
                transaction
                    .reverse_operations
                    .push(Operation::AddSheetSchema {
                        schema: Box::new(export_sheet(deleted_sheet)),
                    });
            }

            // create a sheet if we deleted the last one (only for user actions)
            if transaction.is_user_ai() && self.sheet_ids().is_empty() {
                let new_first_sheet_id = SheetId::new();
                let name = SHEET_NAME.to_owned() + "1";
                let order = self.grid.end_order();
                let new_first_sheet = Sheet::new(new_first_sheet_id, name, order);
                self.grid.add_sheet(Some(new_first_sheet.clone()));

                if transaction.is_user_ai_undo_redo() {
                    transaction.forward_operations.push(Operation::AddSheet {
                        sheet: Box::new(new_first_sheet),
                    });
                    transaction.reverse_operations.push(Operation::DeleteSheet {
                        sheet_id: new_first_sheet_id,
                    });
                }

                // if that's the last sheet, then we created a new one and we have to let the workers know
                self.send_add_sheet(transaction, new_first_sheet_id);
            }
            // send the delete sheet information to the workers
            self.send_delete_sheet(transaction, sheet_id);
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
            sheet.order.clone_from(&order);
            self.grid.move_sheet(target, order.clone());

            if transaction.is_user_ai_undo_redo() {
                if old_first != self.grid.first_sheet_id() {
                    transaction.generate_thumbnail = true;
                }

                transaction
                    .forward_operations
                    .push(Operation::ReorderSheet { target, order });

                transaction
                    .reverse_operations
                    .push(Operation::ReorderSheet {
                        target,
                        order: original_order,
                    });
            }

            self.update_a1_context_sheet_map(target);
            transaction.sheet_info.insert(target);
        }
    }

    pub(crate) fn execute_set_sheet_name(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetSheetName { sheet_id, name } = op {
            if let Err(e) = Sheet::validate_sheet_name(&name, sheet_id, self.a1_context()) {
                if cfg!(target_family = "wasm") || cfg!(test) {
                    crate::wasm_bindings::js::jsClientMessage(
                        e.to_owned(),
                        JsSnackbarSeverity::Error.to_string(),
                    );
                }
                // clear remaining operations
                transaction.operations.clear();
                bail!(e);
            }

            let old_name = self.grid.update_sheet_name(sheet_id, &name)?;

            if transaction.is_user_ai_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::SetSheetName { sheet_id, name });
                transaction
                    .reverse_operations
                    .push(Operation::SetSheetName {
                        sheet_id,
                        name: old_name,
                    });
            }

            self.update_a1_context_sheet_map(sheet_id);
            transaction.sheet_info.insert(sheet_id);
        }

        Ok(())
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
            sheet.color.clone_from(&color);

            if transaction.is_user_ai_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::SetSheetColor { sheet_id, color });
                transaction
                    .reverse_operations
                    .push(Operation::SetSheetColor {
                        sheet_id,
                        color: old_color,
                    });
            }

            self.update_a1_context_sheet_map(sheet_id);
            transaction.sheet_info.insert(sheet_id);
        }
    }

    pub(crate) fn execute_duplicate_sheet(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::DuplicateSheet {
            sheet_id,
            new_sheet_id,
        } = op
        {
            let Some(sheet) = self.try_sheet(sheet_id) else {
                // sheet may have been deleted
                return;
            };
            let mut new_sheet = sheet.clone();
            new_sheet.id = new_sheet_id;
            let right = self.grid.next_sheet(sheet_id);
            let right_order = right.map(|right| right.order.clone());
            if let Ok(order) = key_between(Some(&sheet.order), right_order.as_deref()) {
                new_sheet.order = order;
            };
            let name = format!("{} Copy", sheet.name);
            if self.try_sheet_from_name(&name).is_some() {
                new_sheet.name = crate::util::unused_name(&name, &self.sheet_names());
            } else {
                new_sheet.name = name;
            }
            self.grid.add_sheet(Some(new_sheet));

            self.send_add_sheet(transaction, new_sheet_id);

            if transaction.is_user_ai_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::DuplicateSheet {
                        sheet_id,
                        new_sheet_id,
                    });
                transaction.reverse_operations.push(Operation::DeleteSheet {
                    sheet_id: new_sheet_id,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, SheetPos,
        controller::{
            GridController, active_transactions::transaction_name::TransactionName,
            operations::operation::Operation, user_actions::import::tests::simple_csv_at,
        },
        grid::{CodeCellLanguage, CodeCellValue, SheetId, js_types::JsUpdateCodeCell},
        wasm_bindings::{
            controller::sheet_info::SheetInfo,
            js::{clear_js_calls, expect_js_call},
        },
    };

    #[test]
    fn test_add_sheet() {
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);
        assert_eq!(gc.grid.sheets().len(), 2);
        let sheet_id = gc.sheet_ids()[1];
        let sheet = gc.sheet(sheet_id);
        let sheet_info = SheetInfo::from(sheet);
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        // was jsAddSheet called with the right stuff
        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        expect_js_call("jsDeleteSheet", format!("{},{}", sheet_id, true), true);
    }

    #[test]
    fn test_delete_sheet() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.delete_sheet(sheet_id, None, false);
        assert_eq!(gc.grid.sheets().len(), 1);
        expect_js_call("jsDeleteSheet", format!("{},{}", sheet_id, true), true);
        let new_sheet_id = gc.sheet_ids()[0];

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        let sheet = gc.sheet(sheet_id);
        let sheet_info = SheetInfo::from(sheet);
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            false,
        );
        expect_js_call("jsDeleteSheet", format!("{},{}", new_sheet_id, true), true);
    }

    #[test]
    fn test_undo_delete_sheet_code_rerun() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(SheetPos::new(sheet_id, 1, 1), "1".to_string(), None, false);
        gc.set_cell_value(SheetPos::new(sheet_id, 1, 2), "1".to_string(), None, false);
        let sheet_pos = SheetPos::new(sheet_id, 2, 1);
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "A1 + A2".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((2, 1).into()),
            Some(CellValue::Number(2.into()))
        );
        gc.delete_sheet(sheet_id, None, false);
        assert_eq!(gc.grid.sheets().len(), 1);
        expect_js_call("jsDeleteSheet", format!("{},{}", sheet_id, true), true);

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        let sheet = gc.sheet(sheet_id);
        let sheet_info = SheetInfo::from(sheet);
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            false,
        );

        // code cells should rerun and send updated code cell

        let update_code_cell = JsUpdateCodeCell {
            sheet_id,
            pos: sheet_pos.into(),
            render_code_cell: sheet.get_render_code_cell(sheet_pos.into()),
        };

        expect_js_call(
            "jsUpdateCodeCells",
            format!("{:?}", serde_json::to_vec(&vec![update_code_cell]).unwrap()),
            true,
        );
    }

    #[test]
    fn test_execute_operation_set_sheet_name() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let name = "new name".to_string();
        gc.set_sheet_name(sheet_id, name.clone(), None, false);
        assert_eq!(gc.grid.sheets()[0].name, name);

        let sheet_info = SheetInfo::from(gc.sheet(sheet_id));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].name, "Sheet 1".to_string());
        let sheet_info = SheetInfo::from(gc.sheet(sheet_id));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );
    }

    #[test]
    fn test_set_sheet_color() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let color = Some("red".to_string());
        gc.set_sheet_color(sheet_id, color.clone(), None, false);
        assert_eq!(gc.grid.sheets()[0].color, color);
        let sheet_info = SheetInfo::from(gc.sheet(sheet_id));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].color, None);
        let sheet_info = SheetInfo::from(gc.sheet(sheet_id));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );
    }

    #[test]
    fn test_sheet_reorder() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Sheet1, Sheet 2
        gc.add_sheet(None, None, None, false);
        assert_eq!(gc.grid.sheets().len(), 2);
        let sheet_id2 = gc.sheet_ids()[1];
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);

        // Sheet 2, Sheet1
        gc.move_sheet(sheet_id, None, None, false);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);

        let sheet_info = SheetInfo::from(gc.sheet(sheet_id));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );

        // Sheet1, Sheet 2
        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);
        let sheet_info = SheetInfo::from(gc.sheet(sheet_id));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );

        gc.move_sheet(sheet_id2, Some(sheet_id), None, false);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id2);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id);
        let sheet_info = SheetInfo::from(gc.sheet(sheet_id2));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets()[0].id, sheet_id);
        assert_eq!(gc.grid.sheets()[1].id, sheet_id2);
        let sheet_info = SheetInfo::from(gc.sheet(sheet_id2));
        expect_js_call(
            "jsSheetInfoUpdate",
            format!("{:?}", serde_json::to_vec(&sheet_info).unwrap()),
            true,
        );
    }

    #[test]
    fn test_duplicate_sheet() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "10 + 10".to_string(),
            None,
            None,
            false,
        );

        let op = vec![Operation::DuplicateSheet {
            sheet_id,
            new_sheet_id: SheetId::new(),
        }];
        gc.start_user_ai_transaction(op, None, TransactionName::DuplicateSheet, false);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, "Sheet 1 Copy");
        let duplicated_sheet_id = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 1);
        expect_js_call(
            "jsDeleteSheet",
            format!("{},{}", duplicated_sheet_id, true),
            true,
        );

        let op = vec![Operation::DuplicateSheet {
            sheet_id,
            new_sheet_id: SheetId::new(),
        }];
        gc.start_user_ai_transaction(op, None, TransactionName::DuplicateSheet, false);
        assert_eq!(gc.grid.sheets().len(), 2);
        let duplicated_sheet_id2 = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id2));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        let op = vec![Operation::DuplicateSheet {
            sheet_id,
            new_sheet_id: SheetId::new(),
        }];
        gc.start_user_ai_transaction(op, None, TransactionName::DuplicateSheet, false);
        assert_eq!(gc.grid.sheets().len(), 3);
        assert_eq!(gc.grid.sheets()[1].name, "Sheet 1 Copy 1");
        assert_eq!(gc.grid.sheets()[2].name, "Sheet 1 Copy");
        let duplicated_sheet_id3 = gc.grid.sheets()[1].id;
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id3));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );

        gc.undo(None);
        assert_eq!(gc.grid.sheets().len(), 2);
        assert_eq!(gc.grid.sheets()[1].name, "Sheet 1 Copy");
        expect_js_call(
            "jsDeleteSheet",
            format!("{},{}", duplicated_sheet_id3, true),
            true,
        );

        gc.redo(None);
        assert_eq!(gc.grid.sheets().len(), 3);
        assert_eq!(gc.grid.sheets()[1].name, "Sheet 1 Copy 1");
        let sheet_info = SheetInfo::from(gc.sheet(duplicated_sheet_id3));
        expect_js_call(
            "jsAddSheet",
            format!("{:?},{}", serde_json::to_vec(&sheet_info).unwrap(), true),
            true,
        );
    }

    #[test]
    fn test_duplicate_sheet_with_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);

        gc.test_set_code_run_array_2d(sheet_id, 10, 10, 2, 2, vec!["1", "2", "3", "4"]);
        gc.set_code_cell(
            pos![sheet_id!J10],
            CodeCellLanguage::Python,
            format!("q.cells('{file_name}')"),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id)
                .data_table_at(&pos![J10].into())
                .unwrap()
                .name(),
            "Table1"
        );

        gc.test_set_code_run_array_2d(sheet_id, 20, 20, 2, 2, vec!["1", "2", "3", "4"]);
        let quoted_sheet = crate::a1::quote_sheet_name(gc.sheet_names()[0]);
        gc.set_code_cell(
            pos![sheet_id!T20],
            CodeCellLanguage::Python,
            format!(r#"q.cells("F5") + q.cells("{quoted_sheet}!Q9")"#),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id)
                .data_table_at(&pos![T20].into())
                .unwrap()
                .name(),
            "Table2"
        );

        let ops = gc.duplicate_sheet_operations(sheet_id, None);
        gc.start_user_ai_transaction(ops, None, TransactionName::DuplicateSheet, false);

        let duplicated_sheet_id = gc.sheet_ids()[1];
        let data_table = gc
            .sheet(duplicated_sheet_id)
            .data_table_at(&pos.into())
            .unwrap();
        assert_eq!(data_table.name().to_string(), format!("{file_name}1"));
        assert_eq!(
            gc.sheet(duplicated_sheet_id).cell_value(pos![J10]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: format!("q.cells(\"{file_name}1\")"),
            })
        );

        let new_quoted_sheet = crate::a1::quote_sheet_name(gc.sheet_names()[1]);
        assert_eq!(
            gc.sheet(duplicated_sheet_id).cell_value(pos![T20]).unwrap(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: format!(r#"q.cells("F5") + q.cells("{new_quoted_sheet}!Q9")"#),
            })
        );

        assert_eq!(
            gc.sheet(duplicated_sheet_id)
                .data_table_at(&pos![J10].into())
                .unwrap()
                .name(),
            "Table3"
        );
        assert_eq!(
            gc.sheet(duplicated_sheet_id)
                .data_table_at(&pos![T20].into())
                .unwrap()
                .name(),
            "Table4"
        );
    }
}
