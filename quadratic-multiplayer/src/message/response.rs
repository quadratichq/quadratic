//! Websocket Message Responses
//!
//! A central place for websocket messages responses.

use crate::error::{ErrorLevel, MpError};
use crate::state::settings::MinVersion;
use crate::state::user::{User, UserStateUpdate};
use dashmap::DashMap;
use quadratic_core::controller::transaction::Transaction;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
        operations: Vec<u8>,
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

impl From<(DashMap<Uuid, User>, &MinVersion)> for MessageResponse {
    fn from((users, min_version): (DashMap<Uuid, User>, &MinVersion)) -> Self {
        MessageResponse::UsersInRoom {
            users: users.into_iter().map(|user| (user.1)).collect(),
            min_version: min_version.to_owned(),
        }
    }
}
