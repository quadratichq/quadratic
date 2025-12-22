//! Websocket Message Responses
//!
//! A central place for websocket messages responses.

use crate::{
    error::ErrorLevel,
    multiplayer::message::{User, UserStateUpdate},
};

use base64::{Engine, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct TransactionServer {
    pub id: Uuid,
    pub file_id: Uuid,
    pub operations: Vec<u8>,
    pub sequence_num: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Transaction {
    pub id: Uuid,
    pub file_id: Uuid,
    pub sequence_num: u64,
    pub operations: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BinaryTransaction {
    pub id: Uuid,
    pub file_id: Uuid,
    pub sequence_num: u64,
    pub operations: Vec<u8>,
}

// TODO: to be deleted after the next release
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MinVersion {
    pub required_version: u32,
    pub recommended_version: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ResponseError {
    MissingTransactions(String, String),
    Unknown(String),
}

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub enum MessageResponse {
    UsersInRoom {
        users: Vec<User>,
        version: String,

        // TODO: to be deleted after the next release
        min_version: MinVersion,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserStateUpdate,
    },
    Transaction {
        id: Uuid,
        file_id: Uuid,
        sequence_num: u64,
        operations: String,
    },
    BinaryTransaction {
        id: Uuid,
        file_id: Uuid,
        sequence_num: u64,
        operations: Vec<u8>,
    },
    TransactionAck {
        id: Uuid,
        file_id: Uuid,
        sequence_num: u64,
    },
    Transactions {
        transactions: Vec<Transaction>,
    },
    BinaryTransactions {
        transactions: Vec<BinaryTransaction>,
    },
    EnterRoom {
        file_id: Uuid,
        sequence_num: u64,
    },
    CurrentTransaction {
        sequence_num: u64,
    },
    Error {
        error: ResponseError,
        error_level: ErrorLevel,
    },
    Pong {
        message: String,
    },
}

impl MessageResponse {
    pub fn is_binary(&self) -> bool {
        matches!(
            self,
            MessageResponse::BinaryTransaction { .. } | MessageResponse::BinaryTransactions { .. }
        )
    }
}

impl From<TransactionServer> for Transaction {
    fn from(transaction_server: TransactionServer) -> Self {
        Transaction {
            id: transaction_server.id,
            file_id: transaction_server.file_id,
            sequence_num: transaction_server.sequence_num,
            operations: STANDARD.encode(&transaction_server.operations),
        }
    }
}

impl From<TransactionServer> for BinaryTransaction {
    fn from(transaction_server: TransactionServer) -> Self {
        BinaryTransaction {
            id: transaction_server.id,
            file_id: transaction_server.file_id,
            sequence_num: transaction_server.sequence_num,
            operations: transaction_server.operations,
        }
    }
}
