use super::pending_transaction::PendingTransaction;
use crate::controller::transaction::Transaction;
use serde::{Deserialize, Serialize};
use std::ops::{Deref, DerefMut};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct UnsavedTransaction {
    pub forward: Transaction,
    pub reverse: Transaction,
    pub sent_to_server: bool,
}

impl UnsavedTransaction {
    pub(super) fn id(&self) -> Uuid {
        self.forward.id
    }
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct UnsavedTransactions {
    transactions: Vec<UnsavedTransaction>,
}

impl UnsavedTransactions {
    /// Finds a the forward transaction by its transaction_id.
    ///
    /// Returns `(index, transaction)`.
    pub fn find_forward(&self, transaction_id: Uuid) -> Option<(usize, &Transaction)> {
        self.transactions
            .iter()
            .enumerate()
            .find(|(_, unsaved_transaction)| unsaved_transaction.id() == transaction_id)
            .map(|(index, unsaved_transaction)| (index, &unsaved_transaction.forward))
    }

    pub fn find(&self, transaction_id: Uuid) -> Option<&UnsavedTransaction> {
        self.transactions
            .iter()
            .find(|unsaved_transaction| unsaved_transaction.id() == transaction_id)
    }

    /// Finds the index of the UnsavedTransaction by its transaction_id.
    pub fn find_index(&self, transaction_id: Uuid) -> Option<usize> {
        self.iter()
            .position(|unsaved_transaction| unsaved_transaction.id() == transaction_id)
    }

    /// Inserts or replaces a `PendingTransaction``.
    pub fn insert_or_replace(&mut self, pending: &PendingTransaction, send: bool) {
        let forward = pending.to_forward_transaction();
        let reverse = pending.to_undo_transaction();

        match self
            .iter_mut()
            .enumerate()
            .find(|(_, unsaved_transaction)| unsaved_transaction.id() == forward.id)
        {
            None => {
                let transaction = UnsavedTransaction {
                    forward,
                    reverse,
                    sent_to_server: false,
                };
                if !cfg!(test) && !cfg!(feature = "multiplayer") && send {
                    if let Ok(stringified) = serde_json::to_string(&transaction) {
                        crate::wasm_bindings::js::addUnsentTransaction(
                            transaction.forward.id.to_string(),
                            stringified,
                        );
                    }
                }
                self.transactions.push(transaction);
            }
            Some((_, unsaved_transaction)) => {
                unsaved_transaction.forward = forward;
                unsaved_transaction.reverse = reverse;
                if !cfg!(test) && !cfg!(feature = "multiplayer") && send {
                    if let Ok(stringified) = serde_json::to_string(&unsaved_transaction) {
                        crate::wasm_bindings::js::addUnsentTransaction(
                            unsaved_transaction.forward.id.to_string(),
                            stringified,
                        );
                    }
                }
            }
        };
    }

    /// Marks a transaction as sent to the server (called by TS after multiplayer.ts successfully sends the transaction)
    pub fn mark_transaction_sent(&mut self, transaction_id: &Uuid) {
        if let Some((index, _)) = self
            .iter()
            .enumerate()
            .find(|(_, unsaved_transaction)| unsaved_transaction.id() == *transaction_id)
        {
            self.transactions[index].sent_to_server = true;
        }
    }
}

impl Deref for UnsavedTransactions {
    type Target = Vec<UnsavedTransaction>;

    fn deref(&self) -> &Vec<UnsavedTransaction> {
        &self.transactions
    }
}

impl DerefMut for UnsavedTransactions {
    fn deref_mut(&mut self) -> &mut Vec<UnsavedTransaction> {
        &mut self.transactions
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{controller::operations::operation::Operation, grid::SheetId};

    #[test]
    fn test_unsaved_transactions() {
        let mut unsaved_transactions = UnsavedTransactions::default();
        let transaction = Transaction::default();
        let id = transaction.id;
        let pending = PendingTransaction {
            id,
            ..Default::default()
        };
        unsaved_transactions.insert_or_replace(&pending, false);
        assert_eq!(
            unsaved_transactions.find_forward(id),
            Some((0, &transaction))
        );
        assert_eq!(unsaved_transactions.find_index(id), Some(0));

        let mut pending_2 = PendingTransaction {
            id: pending.id,
            ..Default::default()
        };
        pending_2.operations.push_front(Operation::ResizeRow {
            sheet_id: SheetId::new(),
            row: 0,
            new_size: 0.0,
        });
        unsaved_transactions.insert_or_replace(&pending_2, false);
        assert_eq!(unsaved_transactions.len(), 1);
        assert_eq!(
            unsaved_transactions.find_forward(id),
            Some((0, &transaction))
        );
    }
}
