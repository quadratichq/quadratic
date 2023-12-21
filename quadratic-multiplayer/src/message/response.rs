//! Websocket Message Responses
//!
//! A central place for storing websocket messages responses.

use dashmap::DashMap;
use serde::Serialize;
use uuid::Uuid;

use crate::error::MpError;
use crate::state::transaction_queue::Transaction;
use crate::state::user::UserStateUpdate;
use crate::state::{room::Room, user::User};

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
    UsersInRoom {
        users: Vec<User>,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserStateUpdate,
    },
    Transaction {
        id: Uuid,
        file_id: Uuid,
        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
        sequence_num: u64,
    },
    Transactions {
        transactions: Vec<Transaction>,
    },
    CurrentTransaction {
        sequence_num: u64,
    },
    Error {
        error: MpError,
    },
}

impl From<Room> for MessageResponse {
    fn from(room: Room) -> Self {
        MessageResponse::UsersInRoom {
            users: room.users.into_iter().map(|user| (user.1)).collect(),
        }
    }
}

impl From<DashMap<Uuid, User>> for MessageResponse {
    fn from(users: DashMap<Uuid, User>) -> Self {
        MessageResponse::UsersInRoom {
            users: users.into_iter().map(|user| (user.1)).collect(),
        }
    }
}
