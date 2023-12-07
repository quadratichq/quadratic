//! Websocket Message Requests
//!
//! A central place for storing websocket messages requests.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::user::UserState;

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageRequest {
    EnterRoom {
        session_id: Uuid,
        user_id: String,
        file_id: Uuid,
        sheet_id: Uuid,
        first_name: String,
        last_name: String,
        image: String,
    },
    LeaveRoom {
        session_id: Uuid,
        file_id: Uuid,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserState,
    },
    Transaction {
        session_id: Uuid,
        file_id: Uuid,

        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
    },
    Heartbeat {
        session_id: Uuid,
        file_id: Uuid,
    },
}
