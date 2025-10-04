//! This module handles active user and multiplayer transactions.
//!
//! It is responsible for:
//! * tracking the state of the current active transaction
//! * tracking the state of pending async transactions
//! * tracking the state of pending multiplayer transactions (both sent and received)

use self::{pending_transaction::PendingTransaction, unsaved_transactions::UnsavedTransactions};
use super::transaction::Transaction;
use crate::error_core::{CoreError, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub mod pending_transaction;
pub mod transaction_name;
pub mod unsaved_transactions;

#[derive(Debug, Default, Clone, PartialEq)]
pub struct ActiveTransactions {
    // async user transactions that are awaiting a response.
    pub async_transactions: Vec<PendingTransaction>,

    // Completed and async user Transactions that do not yet have a sequence number from the server.
    pub unsaved_transactions: UnsavedTransactions,

    // Sorted list of Transactions that we received from multiplayer that are after our last_sequence_num (eg, we received Transactions that were out of order)
    pub out_of_order_transactions: Vec<Transaction>,

    // The last time we sent a GetTransactions request to the server.
    pub last_get_transactions_time: Option<DateTime<Utc>>,

    // The last sequence_num we applied locally.
    pub last_sequence_num: u64,
}

impl ActiveTransactions {
    pub(crate) fn new(last_sequence_num: u64) -> Self {
        ActiveTransactions {
            last_sequence_num,
            ..Default::default()
        }
    }

    /// Returns a transaction index based on the transaction_id
    pub(crate) fn get_async_transaction_index(&self, transaction_id: Uuid) -> Result<usize> {
        self.async_transactions
            .iter()
            .position(|p| p.id == transaction_id && p.has_async > 0)
            .ok_or_else(|| {
                CoreError::TransactionNotFound(
                    "async transaction not found in get_async_transaction".into(),
                )
            })
    }

    /// Returns a transaction based on the transaction_id
    pub(crate) fn get_async_transaction(&self, transaction_id: Uuid) -> Result<PendingTransaction> {
        let index = self.get_async_transaction_index(transaction_id)?;

        Ok(self.async_transactions[index].to_owned())
    }

    /// Removes and returns the mutable awaiting_async transaction based on its transaction_id
    pub(crate) fn remove_awaiting_async(
        &mut self,
        transaction_id: Uuid,
    ) -> Result<PendingTransaction> {
        let index = self.get_async_transaction_index(transaction_id)?;
        let transaction = &mut self.async_transactions[index];
        transaction.has_async -= 1;
        if transaction.has_async > 0 {
            self.get_async_transaction(transaction_id)
        } else {
            Ok(self.async_transactions.remove(index))
        }
    }

    pub(crate) fn add_async_transaction(&mut self, pending: &mut PendingTransaction) {
        // Unsaved_operations hold async operations that are not complete. In that case, we need to replace the
        // unsaved operation with the new version.
        self.unsaved_transactions.insert_or_replace(pending, false);
        pending.has_async += 1;
        let transaction = pending.clone();
        if let Ok(index) = self.get_async_transaction_index(pending.id) {
            self.async_transactions[index] = transaction;
        } else {
            self.async_transactions.push(transaction);
        }
    }

    pub(crate) fn update_async_transaction(&mut self, pending: &PendingTransaction) {
        // Unsaved_operations hold async operations that are not complete. In that case, we need to replace the
        // unsaved operation with the new version.
        self.unsaved_transactions.insert_or_replace(pending, false);
        let transaction = pending.clone();
        if let Ok(index) = self.get_async_transaction_index(pending.id) {
            self.async_transactions[index] = transaction;
        } else {
            dbgjs!("[active_transactions] update_async_transaction: Async transaction not found");
        }
    }

    pub(crate) fn mark_transaction_sent(&mut self, transaction_id: Uuid) {
        self.unsaved_transactions
            .mark_transaction_sent(&transaction_id);
    }

    /// Returns the async_transactions for testing purposes
    #[cfg(test)]
    pub(crate) fn async_transactions(&self) -> &[PendingTransaction] {
        &self.async_transactions
    }

    /// Returns the async_transactions for testing purposes
    #[cfg(test)]
    pub(crate) fn async_transactions_mut(&mut self) -> &mut Vec<PendingTransaction> {
        &mut self.async_transactions
    }
}
