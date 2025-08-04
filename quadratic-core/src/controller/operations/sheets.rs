use lexicon_fractional_index::key_between;

use crate::{
    controller::GridController,
    grid::{Sheet, SheetId, js_types::JsSheetNameToColor},
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

    pub fn set_sheets_color_operations(
        &mut self,
        sheet_names_to_color: Vec<JsSheetNameToColor>,
    ) -> Vec<Operation> {
        sheet_names_to_color
            .into_iter()
            .filter_map(|JsSheetNameToColor { sheet_name, color }| {
                self.grid
                    .try_sheet_from_name(&sheet_name)
                    .map(|sheet| Operation::SetSheetColor {
                        sheet_id: sheet.id,
                        color: Some(color),
                    })
            })
            .collect()
    }

    /// Returns all sheet names
    pub fn sheet_names(&self) -> Vec<&str> {
        self.grid
            .sheets()
            .values()
            .map(|s| s.name.as_str())
            .collect()
    }

    fn get_next_sheet_name(&self) -> String {
        util::unused_name("Sheet", &self.sheet_names())
    }

    pub fn add_sheet_operations(
        &mut self,
        name: Option<String>,
        insert_before_sheet_name: Option<String>,
    ) -> Vec<Operation> {
        let id = SheetId::new();
        let name = name.unwrap_or_else(|| self.get_next_sheet_name());
        let order =
            match insert_before_sheet_name.and_then(|name| self.grid.try_sheet_from_name(&name)) {
                Some(sheet) => {
                    key_between(self.grid.previous_sheet_order(sheet.id), Some(&sheet.order))
                        .unwrap_or_else(|_| self.grid.end_order())
                }
                None => self.grid.end_order(),
            };
        let sheet = Sheet::new(id, name, order);

        vec![Operation::AddSheet {
            sheet: Box::new(sheet),
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
            key_between(before, Some(&to_before.order)).unwrap()
        } else {
            let last_order = self
                .grid
                .sheets()
                .last()
                .map(|(_, last)| last.order.clone());
            key_between(last_order.as_deref(), None).unwrap()
        };

        vec![Operation::ReorderSheet {
            target: sheet_id,
            order,
        }]
    }

    pub fn duplicate_sheet_operations(
        &mut self,
        sheet_id: SheetId,
        name_of_new_sheet: Option<String>,
    ) -> Vec<Operation> {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            // sheet may have been deleted
            return vec![];
        };

        // clone the sheet and update id, name and order
        let mut new_sheet = sheet.clone();
        let new_sheet_id = SheetId::new();
        let new_name = name_of_new_sheet.unwrap_or_else(|| format!("{} Copy", sheet.name));
        new_sheet.id = new_sheet_id;
        new_sheet.name = new_name.clone();

        new_sheet.replace_sheet_name_in_code_cells(&sheet.name, &new_name);

        let right_order = self
            .grid
            .next_sheet(sheet_id)
            .map(|right| right.order.clone());
        if let Ok(order) = key_between(Some(&sheet.order.clone()), right_order.as_deref()) {
            new_sheet.order = order;
        };

        let mut ops = vec![Operation::AddSheet {
            sheet: Box::new(new_sheet),
        }];

        // get code run operations for the old sheet, as new sheet is not yet in the grid
        let mut code_run_ops = self.rerun_sheet_code_cells_operations(sheet_id);
        // update sheet_id in code_run_ops to new sheet id
        code_run_ops.iter_mut().for_each(|op| {
            if let Operation::ComputeCode { sheet_pos } = op {
                sheet_pos.sheet_id = new_sheet_id;
            }
        });

        ops.extend(code_run_ops);
        ops
    }
}

#[cfg(test)]
mod test {
    use crate::controller::user_actions::import::tests::simple_csv;

    use super::*;

    #[test]
    fn test_move_sheet_operation() {
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);
        gc.add_sheet(None, None, None, false);

        // 1, 2, 3
        let sheet_ids = gc.sheet_ids();

        let ops = gc.move_sheet_operations(sheet_ids[0], Some(sheet_ids[1]));
        assert_eq!(ops.len(), 1);
        if let Operation::ReorderSheet { target, order } = &ops[0] {
            assert_eq!(target, &sheet_ids[0]);
            let key = key_between(
                Some(&gc.sheet_index(0).order.clone()),
                Some(&gc.sheet_index(1).order.clone()),
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
            let key = key_between(None, Some(&gc.sheet_index(0).order.clone())).unwrap();
            assert_eq!(order, &key);
        } else {
            panic!("wrong operation type");
        }

        // 1, 3, 2
        let ops = gc.move_sheet_operations(sheet_ids[1], None);
        assert_eq!(ops.len(), 1);
        if let Operation::ReorderSheet { target, order } = &ops[0] {
            assert_eq!(target, &sheet_ids[1]);
            let key = key_between(Some(&gc.sheet_index(2).order.clone()), None).unwrap();
            assert_eq!(order, &key);
        } else {
            panic!("wrong operation type");
        }
    }

    #[test]
    fn get_sheet_next_name() {
        // Sheet1
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);
        // Sheet1 | Sheet 2
        assert_eq!(gc.sheet_index(1).name, "Sheet 2");
        gc.sheet_mut(gc.sheet_ids()[1]).name = "Sheet 2 modified".to_string();
        // Sheet1 | Sheet 2 modified
        gc.add_sheet(None, None, None, false);
        // Sheet1 | Sheet 2 modified | Sheet 2
        assert_eq!(gc.sheet_index(2).name, "Sheet 2");
        gc.delete_sheet(gc.sheet_ids()[0], None, false);
        // Sheet 2 modified | Sheet 2
        gc.add_sheet(None, None, None, false);
        // Sheet 2 modified | Sheet 2 | Sheet 3
        assert_eq!(gc.sheet_index(2).name, "Sheet 3");
    }

    #[test]
    fn sheet_names() {
        let mut gc = GridController::test();
        gc.add_sheet(None, None, None, false);
        gc.add_sheet(None, None, None, false);
        assert_eq!(gc.sheet_names(), vec!["Sheet 1", "Sheet 2", "Sheet 3"]);
    }

    #[test]
    fn test_duplicate_sheet_with_data_table() {
        let (mut gc, sheet_id, _, _) = simple_csv();

        let duplicate_sheet = gc.sheet_mut(sheet_id).clone();
        let duplicate_sheet_id = gc.grid.add_sheet(Some(duplicate_sheet));
        let data_tables = gc.sheet(duplicate_sheet_id).data_tables.clone();

        let context = gc.a1_context().to_owned();

        for (pos, data_table) in data_tables.into_iter() {
            let name = data_table.name().to_string();
            let sheet_pos = pos.to_sheet_pos(duplicate_sheet_id);
            gc.grid
                .update_data_table_name(sheet_pos, &name, &name, &context, false)
                .unwrap();
        }

        println!("duplicate: {:?}", gc.sheet(duplicate_sheet_id).data_tables);
    }
}
