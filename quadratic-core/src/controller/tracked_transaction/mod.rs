//! Tracks changes to the grid since the user joined the file.

use ts_rs::TS;

use crate::controller::{
    GridController,
    active_transactions::{
        pending_transaction::PendingTransaction, transaction_name::TransactionName,
    },
    execution::TransactionSource,
    operations::tracked_operation::TrackedOperation,
};

#[derive(Debug, Clone, PartialEq, TS)]
pub struct TrackedTransaction {
    source: TransactionSource,
    transaction_name: TransactionName,
    operations: Vec<TrackedOperation>,
    time_stamp: u64,
}

#[derive(Default, Debug, Clone, PartialEq)]
pub struct TrackedTransactions {
    changes: Vec<TrackedTransaction>,
}

impl TrackedTransactions {
    pub fn add(&mut self, transaction: TrackedTransaction) {
        self.changes.push(transaction);
    }
}

impl GridController {
    /// Add changes to the change tracker.
    pub fn track_transactions(&mut self, transaction: &PendingTransaction) {
        if transaction.complete && (cfg!(target_family = "wasm") || cfg!(test)) {
            self.tracked_transactions.add(TrackedTransaction {
                source: transaction.source,
                transaction_name: transaction.transaction_name,
                operations: transaction
                    .forward_operations
                    .iter()
                    .flat_map(|op| TrackedOperation::from_operation(op, self))
                    .collect::<Vec<_>>(),
                time_stamp: crate::wasm_bindings::js::timestamp() as u64,
            });
        }
    }

    /// Get the changes from the change tracker.
    pub fn get_changes(&self) -> &Vec<TrackedTransaction> {
        &self.tracked_transactions.changes
    }
}
