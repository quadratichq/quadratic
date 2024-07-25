use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::SheetRect;

use super::{
    active_transactions::pending_transaction::PendingTransaction, execution::TransactionType,
    operations::operation::Operation, GridController,
};

// Transaction created by client
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct Transaction {
    pub id: Uuid,
    pub sequence_num: Option<u64>,
    pub operations: Vec<Operation>,
    pub cursor: Option<String>,
    pub batch_client_update_rect: Option<SheetRect>,
}

impl Transaction {
    pub fn to_undo_transaction(
        &self,
        transaction_type: TransactionType,
        cursor: Option<String>,
    ) -> PendingTransaction {
        PendingTransaction {
            id: self.id,
            cursor,
            cursor_undo_redo: self.cursor.clone(),
            transaction_type,
            operations: self.operations.clone().into(),
            batch_client_update_rect: self.batch_client_update_rect,
            ..Default::default()
        }
    }
}

// Transaction received from Server
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct TransactionServer {
    pub id: Uuid,
    pub file_id: Uuid,
    pub operations: Vec<Operation>,
    pub sequence_num: u64,
}

// From doesn't work since we don't have file_id
#[allow(clippy::from_over_into)]
impl Into<Transaction> for TransactionServer {
    fn into(self) -> Transaction {
        Transaction {
            id: self.id,
            sequence_num: Some(self.sequence_num),
            operations: self.operations,
            cursor: None,
            ..Default::default()
        }
    }
}

impl GridController {
    /// Marks a transaction as sent by the multiplayer.ts server
    pub fn mark_transaction_sent(&mut self, transaction_id: Uuid) {
        self.transactions.mark_transaction_sent(transaction_id);
    }
}
