//! Websocket Message Requests
//!
//! A central place for storing websocket messages requests.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::user::{CellEdit, UserStateUpdate};

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Deserialize, Debug, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageRequest {
    EnterRoom {
        session_id: Uuid,
        user_id: String,
        file_id: Uuid,
        first_name: String,
        last_name: String,
        email: String,
        image: String,
        sheet_id: Uuid,
        selection: String,
        cell_edit: CellEdit,
        viewport: String,
    },
    LeaveRoom {
        session_id: Uuid,
        file_id: Uuid,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserStateUpdate,
    },
    Transaction {
        id: Uuid,
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
