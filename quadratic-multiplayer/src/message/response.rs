//! Websocket Message Responses
//!
//! A central place for websocket messages responses.

use crate::error::MpError;
use crate::state::user::{User, UserStateUpdate};

use base64::{Engine, engine::general_purpose::STANDARD};
use dashmap::DashMap;
use quadratic_core::controller::transaction::TransactionServer;
use quadratic_rust_shared::ErrorLevel;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct Transaction {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) sequence_num: u64,
    pub(crate) operations: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct BinaryTransaction {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) sequence_num: u64,
    pub(crate) operations: Vec<u8>,
}

// TODO: to be deleted after the next release
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MinVersion {
    pub(crate) required_version: u32,
    pub(crate) recommended_version: u32,
}

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
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
        error: MpError,
        error_level: ErrorLevel,
    },
}

impl MessageResponse {
    pub(crate) fn is_binary(&self) -> bool {
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

impl From<(DashMap<Uuid, User>, &String)> for MessageResponse {
    fn from((users, version): (DashMap<Uuid, User>, &String)) -> Self {
        MessageResponse::UsersInRoom {
            users: users.into_iter().map(|user| (user.1)).collect(),
            version: version.to_owned(),

            // TODO: to be deleted after next version
            min_version: MinVersion {
                required_version: 5,
                recommended_version: 5,
            },
        }
    }
}
