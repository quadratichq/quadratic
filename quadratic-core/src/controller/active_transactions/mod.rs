//! This module handles active user and multiplayer transactions.
//!
//! It is responsible for:
//! * tracking the state of the current active transaction
//! * tracking the state of pending async transactions
//! * tracking the state of pending multiplayer transactions (both sent and received)

use self::pending_transaction::PendingTransaction;
use super::transaction::Transaction;
use crate::error_core::{CoreError, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;
pub mod pending_transaction;

#[derive(Debug, Default, Clone, PartialEq)]
pub struct ActiveTransactions {
    // async user transactions that are awaiting a response.
    async_transactions: Vec<PendingTransaction>,

    // Completed and async user Transactions that do not yet have a sequence number from the server.
    // Vec<(forward_transaction, reverse_transaction)>
    pub unsaved_transactions: Vec<(Transaction, Transaction)>,

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

    pub fn find_unsaved_transaction(&self, transaction_id: Uuid) -> Option<(usize, &Transaction)> {
        self.unsaved_transactions
            .iter()
            .enumerate()
            .find(|(_, (forward, _))| forward.id == transaction_id)
            .map(|(index, (forward, _))| (index, forward))
    }

    pub fn add_async_transaction(&mut self, pending: &PendingTransaction) {
        let forward = pending.to_forward_transaction();
        let undo = pending.to_undo_transaction();
        self.unsaved_transactions.push((forward, undo));
        self.async_transactions.push(pending.clone());
    }

    /// Returns the async_transactions for testing purposes
    #[cfg(test)]
    pub fn async_transactions(&self) -> &[PendingTransaction] {
        &self.async_transactions
    }
}
