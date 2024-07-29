use anyhow::Result;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use uuid::Uuid;

use crate::compression::{
    decompress_and_deserialize, serialize_and_compress, CompressionFormat, SerializationFormat,
};

use super::{
    active_transactions::pending_transaction::PendingTransaction, execution::TransactionType,
    operations::operation::Operation, GridController,
};

pub static SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Json;
pub static COMPRESSION_FORMAT: CompressionFormat = CompressionFormat::Zlib;

// Transaction created by client
#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct Transaction {
    pub id: Uuid,
    pub sequence_num: Option<u64>,
    pub operations: Vec<Operation>,
    pub cursor: Option<String>,
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
            ..Default::default()
        }
    }

    pub fn serialize_and_compress<T: Serialize>(opearations: &T) -> Result<Vec<u8>> {
        serialize_and_compress::<T>(&SERIALIZATION_FORMAT, &COMPRESSION_FORMAT, opearations)
    }

    pub fn decompress_and_deserialize<T: DeserializeOwned>(opearations: &[u8]) -> Result<T> {
        decompress_and_deserialize::<T>(&SERIALIZATION_FORMAT, &COMPRESSION_FORMAT, opearations)
    }
}

// Transaction received from Server
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct TransactionServer {
    pub id: Uuid,
    pub file_id: Uuid,
    pub operations: Vec<u8>,
    pub sequence_num: u64,
}

// From doesn't work since we don't have file_id
#[allow(clippy::from_over_into)]
impl TryInto<Transaction> for TransactionServer {
    type Error = anyhow::Error;

    fn try_into(self) -> Result<Transaction> {
        let operations = Transaction::decompress_and_deserialize(&self.operations)?;

        Ok(Transaction {
            id: self.id,
            sequence_num: Some(self.sequence_num),
            operations,
            cursor: None,
        })
    }
}

impl GridController {
    /// Marks a transaction as sent by the multiplayer.ts server
    pub fn mark_transaction_sent(&mut self, transaction_id: Uuid) {
        self.transactions.mark_transaction_sent(transaction_id);
    }
}
