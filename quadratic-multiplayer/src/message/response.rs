//! Websocket Message Responses
//!
//! A central place for storing websocket messages responses.

use serde::Serialize;
use uuid::Uuid;

use crate::state::user::UserState;
use crate::state::{room::Room, user::User};

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
    UsersInRoom {
        users: Vec<User>,
    },
    Transaction {
        file_id: Uuid,
        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserState,
    },

    // note: this is ignored in broadcast
    Empty {},
}

impl From<Room> for MessageResponse {
    fn from(room: Room) -> Self {
        MessageResponse::UsersInRoom {
            users: room.users.into_iter().map(|user| (user.1)).collect(),
        }
    }
}
