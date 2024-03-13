//! Websocket Message Responses
//!
//! A central place for websocket messages responses.

use crate::error::MpError;
use crate::state::user::{User, UserStateUpdate};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::min_version::MinVersion;

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
        transactions: String,
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
    },
}

impl From<DashMap<Uuid, User>> for MessageResponse {
    fn from(users: DashMap<Uuid, User>) -> Self {
        MessageResponse::UsersInRoom {
            users: users.into_iter().map(|user| (user.1)).collect(),
            min_version: MinVersion {
                required_version: 1,
                recommended_version: 1,
            },
        }
    }
}
