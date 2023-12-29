use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::operations::operation::Operation;

// Transaction created by client
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct Transaction {
    pub id: Uuid,
    pub sequence_num: Option<u64>,
    pub operations: Vec<Operation>,
    pub cursor: Option<String>,
}

// Transaction received from Server
#[derive(Serialize, Debug, PartialEq, Clone)]
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
        }
    }
}
