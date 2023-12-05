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

use crate::state::{Room, State, User};

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
    MouseMove {
        session_id: Uuid,
        file_id: Uuid,
        x: Option<f64>,
        y: Option<f64>,
    },
    ChangeSelection {
        session_id: Uuid,
        file_id: Uuid,
        selection: String,
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
    Room {
        room: Room,
    },
    MouseMove {
        session_id: Uuid,
        file_id: Uuid,
        x: Option<f64>,
        y: Option<f64>,
    },
    ChangeSelection {
        session_id: Uuid,
        file_id: Uuid,
        selection: String,
    },
    Transaction {
        session_id: Uuid,
        file_id: Uuid,

        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
    },
    Empty {},
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
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };
            let session_id = user.session_id;
            let is_new = state.enter_room(file_id, &user, internal_session_id).await;
            let room = state.get_room(&file_id).await?;
            let response = MessageResponse::Room { room };

            // only broadcast if the user is new to the room
            if is_new {
                broadcast(session_id, file_id, Arc::clone(&state), response.clone())?;
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
            let response = MessageResponse::Room { room };

            if is_not_empty {
                broadcast(session_id, file_id, Arc::clone(&state), response.clone())?
            }

            Ok(response)
        }

        // User moves their mouse
        MessageRequest::MouseMove {
            session_id,
            file_id,
            x,
            y,
        } => {
            let response = MessageResponse::MouseMove {
                session_id,
                file_id,
                x,
                y,
            };

            broadcast(session_id, file_id, Arc::clone(&state), response.clone())?;

            Ok(response)
        }

        // User changes their selection
        MessageRequest::ChangeSelection {
            session_id,
            file_id,
            selection,
        } => {
            let response = MessageResponse::ChangeSelection {
                session_id,
                file_id,
                selection,
            };

            broadcast(session_id, file_id, Arc::clone(&state), response.clone())?;

            Ok(response)
        }

        // User sends transactions
        MessageRequest::Transaction {
            session_id,
            file_id,
            operations,
        } => {
            let response = MessageResponse::Transaction {
                session_id,
                file_id,
                operations,
            };

            broadcast(session_id, file_id, Arc::clone(&state), response.clone())?;

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
    }
}

/// Broadcast a message to all users in a room except the sender.
/// All messages are sent in a separate thread.
pub(crate) fn broadcast(
    session_id: Uuid,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) -> Result<()> {
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

    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::test_util::add_new_user_to_room;

    #[tokio::test]
    async fn test_mouse_move() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::MouseMove {
            session_id: user_1.session_id,
            file_id,
            x: Some(10f64),
            y: Some(10f64),
        };
        broadcast(user_1.session_id, file_id, state, message).unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_selection() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::ChangeSelection {
            session_id: user_1.session_id,
            file_id,
            selection: "test".to_string(),
        };
        broadcast(user_1.session_id, file_id, state, message).unwrap();

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
            session_id: user_1.session_id,
            file_id,
            operations: "test".to_string(),
        };
        broadcast(user_1.session_id, file_id, state, message).unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
