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
    pub fn new(last_sequence_num: u64) -> Self {
        ActiveTransactions {
            last_sequence_num,
            ..Default::default()
        }
    }

    /// Removes and returns the mutable awaiting_async transaction based on its transaction_id
    pub fn remove_awaiting_async(&mut self, transaction_id: Uuid) -> Result<PendingTransaction> {
        match self
            .async_transactions
            .iter()
            .position(|p| p.id == transaction_id && p.waiting_for_async.is_some())
        {
            None => Err(CoreError::TransactionNotFound(
                "async transaction not found in find_awaiting_async".into(),
            )),
            Some(index) => Ok(self.async_transactions.remove(index)),
        }
    }

    pub fn add_async_transaction(&mut self, pending: &PendingTransaction) {
        // Unsaved_operations hold async operations that are not complete. In that case, we need to replace the
        // unsaved operation with the new version.
        self.unsaved_transactions.insert_or_replace(pending, false);
        self.async_transactions.push(pending.clone());
    }

    pub fn mark_transaction_sent(&mut self, transaction_id: Uuid) {
        self.unsaved_transactions
            .mark_transaction_sent(&transaction_id);
    }

    /// Returns the async_transactions for testing purposes
    #[cfg(test)]
    pub fn async_transactions(&self) -> &[PendingTransaction] {
        &self.async_transactions
    }

    /// Returns the async_transactions for testing purposes
    #[cfg(test)]
    pub fn async_transactions_mut(&mut self) -> &mut Vec<PendingTransaction> {
        &mut self.async_transactions
    }
}
