pub mod auto_resize_row_heights;
pub mod control_transaction;
pub mod execute_operation;
pub mod receive_multiplayer;
pub mod run_code;
pub mod spills;

use super::active_transactions::ActiveTransactions;
use super::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::GridController;
use serde::{Deserialize, Serialize};

/// Where the transaction came from.
#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq, Copy)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum TransactionSource {
    /// Unknown / unspecified.
    #[default]
    Unset,
    /// Local user performed an action directly.
    User,
    /// Local user performed an undo.
    Undo,
    /// Local user performed a redo.
    Redo,
    /// Multiplayer user performed an action.
    Multiplayer,
    /// Server applied a transaction.
    Server,
    /// Local user performed an action and the transaction has not yet been sent
    /// to the server.
    Unsaved,
    /// AI performed an action.
    AI,
    /// AI performed an undo.
    UndoAI,
    /// AI performed a redo.
    RedoAI,
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
