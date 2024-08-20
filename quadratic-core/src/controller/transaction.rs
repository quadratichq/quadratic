use anyhow::Result;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use uuid::Uuid;

use crate::compression::{
    add_header, decompress_and_deserialize, deserialize, remove_header, serialize,
    serialize_and_compress, CompressionFormat, SerializationFormat,
};

use super::{
    active_transactions::pending_transaction::PendingTransaction, execution::TransactionType,
    operations::operation::Operation, GridController,
};

pub static SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Json;
pub static COMPRESSION_FORMAT: CompressionFormat = CompressionFormat::Zlib;
pub static HEADER_SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Bincode;
pub static CURRENT_VERSION: &str = "1.0";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransactionVersion {
    pub version: String,
}

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

    /// Serializes and compresses the transaction's operations, adding a header with the version
    pub fn serialize_and_compress<T: Serialize>(operations: &T) -> Result<Vec<u8>> {
        let version = TransactionVersion {
            version: CURRENT_VERSION.into(),
        };
        let header = serialize(&HEADER_SERIALIZATION_FORMAT, &version)?;
        let compressed =
            serialize_and_compress::<T>(&SERIALIZATION_FORMAT, &COMPRESSION_FORMAT, operations)?;

        add_header(header, compressed)
    }

    /// Decompress and deserialize the transaction's operations, removing the
    /// version header.
    ///
    /// When we start to add different transaction versions, we will need to
    /// match the version and handle the versions separately.
    pub fn decompress_and_deserialize<T: DeserializeOwned>(operations: &[u8]) -> Result<T> {
        let (header, data) = remove_header(operations)?;

        // We're currently not doing anything with the transaction version, but will in
        // the future as we use different serialization and compression methods and/or
        // different operation types.
        let _version = deserialize::<TransactionVersion>(&HEADER_SERIALIZATION_FORMAT, header)?;

        decompress_and_deserialize::<T>(&SERIALIZATION_FORMAT, &COMPRESSION_FORMAT, data)
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
