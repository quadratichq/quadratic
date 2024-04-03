pub mod control_transaction;
pub mod execute_operation;
pub mod receive_multiplayer;
pub mod run_code;
pub mod spills;

use super::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::GridController;
use serde::{Deserialize, Serialize};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TransactionType {
    #[default]
    Unset,
    User,
    Undo,
    Redo,
    Multiplayer,
}

impl GridController {
    /// recalculate bounds for changed sheets
    pub fn recalculate_sheet_bounds(&mut self, transaction: &mut PendingTransaction) {
        transaction
            .sheets_with_dirty_bounds
            .drain()
            .for_each(|sheet_id| {
                if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                    sheet.recalculate_bounds();
                }
            });
    }

    /// Sets the last_sequence_num for multiplayer. This should only be called when receiving the sequence_num.
    pub fn set_last_sequence_num(&mut self, last_sequence_num: u64) {
        self.transactions.last_sequence_num = last_sequence_num;
    }
}

#[cfg(test)]
use super::active_transactions::ActiveTransactions;

#[cfg(test)]
impl GridController {
    /// Gets ActiveTransaction for test purposes
    pub fn active_transactions(&self) -> &ActiveTransactions {
        &self.transactions
    }

    /// Gets the pending transactions for test purposes
    pub fn async_transactions(&self) -> &[PendingTransaction] {
        self.transactions.async_transactions()
    }
}
