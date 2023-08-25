use itertools::Itertools;
use lexicon_fractional_index::key_between;

use crate::grid::{Sheet, SheetId};

use super::{
    transactions::{Operation, Transaction, TransactionSummary},
    GridController,
};

impl GridController {
    pub fn sheet_ids(&self) -> Vec<SheetId> {
        self.grid.sheets().iter().map(|sheet| sheet.id).collect()
    }
    pub fn sheet(&self, sheet_id: SheetId) -> &Sheet {
        self.grid.sheet_from_id(sheet_id)
    }

    pub fn set_sheet_name(
        &mut self,
        sheet_id: SheetId,
        name: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let transaction = Transaction {
            ops: vec![Operation::SetSheetName { sheet_id, name }],
            cursor,
        };
        self.transact_forward(transaction)
    }

    pub fn set_sheet_color(
        &mut self,
        sheet_id: SheetId,
        color: Option<String>,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let transaction = Transaction {
            ops: vec![Operation::SetSheetColor { sheet_id, color }],
            cursor,
        };
        self.transact_forward(transaction)
    }

    pub fn add_sheet(&mut self, cursor: Option<String>) -> TransactionSummary {
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
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn delete_sheet(
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
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn move_sheet(
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
        self.transact_forward(Transaction { ops, cursor })
    }
    pub fn duplicate_sheet(
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
        self.transact_forward(Transaction { ops, cursor })
    }
}
