//! Websocket Message Handler
//!
//! A central place for handling websocket messages.  This module is
//! responsible for incoming requests and outgoing responses.  Since
//! socket information is stored in the global state, we can broadcast
//! to all users in a room.

use std::sync::Arc;

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use futures_util::SinkExt;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::state::{users::User, users::UserUpdate, Room, State};

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
        image: String,
    },
    LeaveRoom {
        session_id: Uuid,
        file_id: Uuid,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserUpdate,
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

// NOTE: needs to be kept in sync with multiplayerTypes.ts
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
    UsersInRoom {
        users: Vec<User>,
    },
    Transaction {
        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
    },
    UserUpdate {
        session_id: Uuid,
        file_id: Uuid,
        update: UserUpdate,
    },

    // todo: this is not ideal. probably want to have the handle_message return an Option to avoid sending empty messages
    Empty {},
}

impl From<Room> for MessageResponse {
    fn from(room: Room) -> Self {
        MessageResponse::UsersInRoom {
            users: room.users.into_iter().map(|user| (user.1)).collect(),
        }
    }
}

/// Handle incoming messages.  All requests and responses are strictly typed.
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    internal_session_id: Uuid,
) -> Result<MessageResponse> {
    tracing::trace!("Handling message {:?}", request);

    match request {
        // User enters a room.
        MessageRequest::EnterRoom {
            session_id,
            user_id,
            file_id,
            first_name,
            last_name,
            image,
        } => {
            let user = User {
                user_id,
                session_id,
                first_name,
                last_name,
                image,
                sheet_id: None,
                x: None,
                y: None,
                selection: None,
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };
            let session_id = user.session_id;
            let is_new = state.enter_room(file_id, &user, internal_session_id).await;
            let room = state.get_room(&file_id).await?;
            let response = MessageResponse::from(room.to_owned());

            // only broadcast if the user is new to the room
            if is_new {
                broadcast(session_id, file_id, Arc::clone(&state), response.clone());
            }

            Ok(response)
        }

        // User leaves a room
        MessageRequest::LeaveRoom {
            session_id,
            file_id,
        } => {
            let is_not_empty = state.leave_room(file_id, &session_id).await?;
            let room = state.get_room(&file_id).await?;
            let response = MessageResponse::from(room.to_owned());

            if is_not_empty {
                broadcast(session_id, file_id, Arc::clone(&state), response.clone());
            }

            Ok(response)
        }

        // User sends transactions
        MessageRequest::Transaction {
            session_id,
            file_id,
            operations,
        } => {
            state.update_heartbeat(file_id, &session_id).await?;
            let response = MessageResponse::Transaction { operations };

            broadcast(session_id, file_id, Arc::clone(&state), response.clone());

            Ok(response)
        }

        // User sends a heartbeat
        MessageRequest::Heartbeat {
            session_id,
            file_id,
        } => {
            state.update_heartbeat(file_id, &session_id).await?;
            Ok(MessageResponse::Empty {})
        }

        MessageRequest::UserUpdate {
            session_id,
            file_id,
            update,
        } => {
            state
                .update_user_state(&file_id, &session_id, &update)
                .await?;
            let response = MessageResponse::UserUpdate {
                session_id,
                file_id,
                update,
            };
            broadcast(session_id, file_id, Arc::clone(&state), response.clone());

            Ok(response)
        }
    }
}

/// Broadcast a message to all users in a room except the sender.
/// All messages are sent in a separate thread.
pub(crate) fn broadcast(
    session_id: Uuid,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) {
    tokio::spawn(async move {
        let result = async {
            for (_, user) in state
                .get_room(&file_id)
                .await?
                .users
                .iter()
                .filter(|(user_session_id, _)| session_id != **user_session_id)
            {
                if let Some(sender) = &user.socket {
                    sender
                        .lock()
                        .await
                        .send(Message::Text(serde_json::to_string(&message)?))
                        .await?;
                }
            }

            Ok::<_, anyhow::Error>(())
        };

        if let Err(e) = result.await {
            tracing::error!("Error broadcasting message: {:?}", e);
        }
    });
}

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::test_util::add_new_user_to_room;

    #[tokio::test]
    async fn test_update_state() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserUpdate {
                sheet_id: Some(Uuid::new_v4()),
                selection: Some("selection".to_string()),
                x: Some(1.0),
                y: Some(2.0),
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_selection() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserUpdate {
                selection: Some("test".to_string()),
                sheet_id: None,
                x: None,
                y: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_transaction() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::Transaction {
            operations: "test".to_string(),
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_sheet() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserUpdate {
                selection: None,
                sheet_id: Some(Uuid::new_v4()),
                x: None,
                y: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
