use anyhow::{Result, bail};
use prost::Message;
use quadratic_rust_shared::protobuf::quadratic::transaction::ReceiveTransaction;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::GridController;
use super::active_transactions::pending_transaction::PendingTransaction;
use super::execution::TransactionSource;
use super::operations::operation::Operation;
use crate::compression::{
    CompressionFormat, SerializationFormat, add_header, decompress_and_deserialize, deserialize,
    remove_header, serialize, serialize_and_compress,
};

pub static HEADER_SERIALIZATION_FORMAT: SerializationFormat = SerializationFormat::Bincode;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransactionHeader {
    pub version: String,
}

impl Default for TransactionHeader {
    fn default() -> Self {
        Self::new()
    }
}

impl TransactionHeader {
    pub(crate) fn new() -> Self {
        Self {
            version: TransactionVersion::current().header.version,
        }
    }

    pub(crate) fn new_from_version(version: &str) -> Self {
        Self {
            version: version.into(),
        }
    }

    pub(crate) fn new_serialized() -> Result<Vec<u8>> {
        let transaction_header = TransactionHeader::new();
        transaction_header.serialize()
    }

    pub(crate) fn serialize(&self) -> Result<Vec<u8>> {
        serialize(&HEADER_SERIALIZATION_FORMAT, self)
    }

    pub(crate) fn parse(header: &[u8]) -> Result<TransactionHeader> {
        deserialize::<TransactionHeader>(&HEADER_SERIALIZATION_FORMAT, header)
    }
}

impl From<&str> for TransactionHeader {
    fn from(version: &str) -> Self {
        Self {
            version: version.into(),
        }
    }
}

impl From<TransactionHeader> for TransactionVersion {
    fn from(header: TransactionHeader) -> Self {
        match header.version.as_str() {
            "1.0" => TransactionVersion::v1(),
            "2.0" => TransactionVersion::v2(),
            "3.0" => TransactionVersion::v3(),
            _ => TransactionVersion::current(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransactionVersion {
    pub header: TransactionHeader,
    pub serialized_format: SerializationFormat,
    pub compression_format: CompressionFormat,
}

impl TransactionVersion {
    pub(crate) fn current() -> Self {
        Self::v3()
    }

    pub(crate) fn v1() -> Self {
        Self {
            header: TransactionHeader::from("1.0"),
            serialized_format: SerializationFormat::Json,
            compression_format: CompressionFormat::Zlib,
        }
    }

    pub(crate) fn v2() -> Self {
        Self {
            header: TransactionHeader::from("2.0"),
            serialized_format: SerializationFormat::Json,
            compression_format: CompressionFormat::Zlib,
        }
    }

    pub(crate) fn v3() -> Self {
        Self {
            header: TransactionHeader::from("3.0"),
            serialized_format: SerializationFormat::Json,
            compression_format: CompressionFormat::Zstd,
        }
    }
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
    pub(crate) fn to_undo_transaction(
        &self,
        transaction_type: TransactionSource,
        cursor: Option<String>,
    ) -> PendingTransaction {
        PendingTransaction {
            id: self.id,
            cursor,
            cursor_undo_redo: self.cursor.clone(),
            source: transaction_type,
            operations: self.operations.clone().into(),
            ..Default::default()
        }
    }

    /// Serializes and compresses the transaction's operations, adding a header with the version
    pub fn add_header(operations: Vec<u8>) -> Result<Vec<u8>> {
        let header = TransactionHeader::new_serialized()?;
        add_header(header, operations)
    }

    /// Process any transaction version
    pub fn process_incoming(operations: &[u8]) -> Result<TransactionServer> {
        let (header, data) = remove_header(operations)?;
        let version = TransactionHeader::parse(header)?.version;

        match version.as_str() {
            "1.0" => decompress_and_deserialize::<TransactionServer>(
                &TransactionVersion::v1().serialized_format,
                &TransactionVersion::v1().compression_format,
                data,
            ),
            // The only difference between v2 and v3 is the compression format (from zlib to zstd).
            "2.0" | "3.0" => {
                let decoded: ReceiveTransaction =
                    Message::decode(data).map_err(|e| anyhow::anyhow!(e))?;

                Ok(TransactionServer {
                    id: Uuid::parse_str(&decoded.id)?,
                    file_id: Uuid::parse_str(&decoded.file_id)?,
                    operations: decoded.operations,
                    sequence_num: decoded.sequence_num,
                })
            }
            _ => bail!("Invalid transaction version: {version}"),
        }
    }

    /// Serializes and compresses the transaction's operations, adding a header with the version.
    /// Outputs the current version of the transaction.
    pub fn serialize_and_compress_version<T: Serialize>(
        operations: T,
        version: &str,
    ) -> Result<Vec<u8>> {
        let header = TransactionHeader::new_from_version(version);
        let serialized_header = header.serialize()?;
        let version = TransactionVersion::from(header);
        let compressed = serialize_and_compress::<T>(
            &version.serialized_format,
            &version.compression_format,
            operations,
        )?;

        add_header(serialized_header, compressed)
    }

    /// Serializes and compresses the transaction's operations, adding a header with the version.
    /// Outputs the current version of the transaction.
    pub fn serialize_and_compress<T: Serialize>(operations: T) -> Result<Vec<u8>> {
        let version = TransactionVersion::current();
        Self::serialize_and_compress_version(operations, &version.header.version)
    }

    /// Decompress and deserialize the transaction's operations, removing the
    /// version header.
    /// Outputs the current version of the transaction.
    pub fn decompress_and_deserialize<T: DeserializeOwned>(operations: &[u8]) -> Result<T> {
        let (header, data) = remove_header(operations)?;

        // We're currently not doing anything with the transaction version, but will in
        // the future as we use different serialization and compression methods and/or
        // different operation types.
        let header = deserialize::<TransactionHeader>(&HEADER_SERIALIZATION_FORMAT, header)?;
        let version = TransactionVersion::from(header);

        decompress_and_deserialize::<T>(
            &version.serialized_format,
            &version.compression_format,
            data,
        )
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
    pub(crate) fn mark_transaction_sent(&mut self, transaction_id: Uuid) {
        self.transactions.mark_transaction_sent(transaction_id);
    }
}
