use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::SheetId,
};

impl GridController {
    pub fn delete_column(&mut self, sheet_id: SheetId, column: i64, cursor: Option<String>) {
        let ops = vec![Operation::DeleteColumn { sheet_id, column }];
        self.start_user_transaction(ops, cursor, TransactionName::ManipulateColumnRow);
    }
}
