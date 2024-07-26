//! Websocket Message Responses
//!
//! A central place for websocket messages responses.

use crate::error::{ErrorLevel, MpError};
use crate::state::settings::MinVersion;
use crate::state::user::{User, UserStateUpdate};
use base64::{engine::general_purpose::STANDARD, Engine};
use dashmap::DashMap;
use quadratic_core::controller::transaction::TransactionServer;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct Transaction {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) sequence_num: u64,
    pub(crate) operations: String,
}

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
    UsersInRoom {
        users: Vec<User>,
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
    Transactions {
        transactions: Vec<Transaction>,
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

impl From<(DashMap<Uuid, User>, &MinVersion)> for MessageResponse {
    fn from((users, min_version): (DashMap<Uuid, User>, &MinVersion)) -> Self {
        MessageResponse::UsersInRoom {
            users: users.into_iter().map(|user| (user.1)).collect(),
            min_version: min_version.to_owned(),
        }
    }
}
