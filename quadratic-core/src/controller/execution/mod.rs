pub mod control_transaction;
pub mod execute_operation;
pub mod receive_multiplayer;
pub mod run_code;
pub mod spills;

use super::active_transactions::pending_transaction::PendingTransaction;
use super::active_transactions::ActiveTransactions;
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
    Server,
    Unsaved,
}

impl GridController {
    /// Sets the last_sequence_num for multiplayer. This should only be called when receiving the sequence_num.
    pub fn set_last_sequence_num(&mut self, last_sequence_num: u64) {
        self.transactions.last_sequence_num = last_sequence_num;
    }
}

// for testing purposes...
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
