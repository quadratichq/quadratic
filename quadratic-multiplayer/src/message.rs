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
        user_id: String,
        file_id: Uuid,
        first_name: String,
        last_name: String,
        image: String,
    },
    LeaveRoom {
        user_id: String,
        file_id: Uuid,
    },
    MouseMove {
        user_id: String,
        file_id: Uuid,
        x: Option<f64>,
        y: Option<f64>,
    },
    ChangeSelection {
        user_id: String,
        file_id: Uuid,
        selection: String,
    },
    Transaction {
        user_id: String,
        file_id: Uuid,

        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
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
        user_id: String,
        file_id: Uuid,
        x: Option<f64>,
        y: Option<f64>,
    },
    ChangeSelection {
        user_id: String,
        file_id: Uuid,
        selection: String,
    },
    Transaction {
        user_id: String,
        file_id: Uuid,

        // todo: this is a stringified Vec<Operation>. Eventually, Operation should be a shared type.
        operations: String,
    },
}

/// Handle incoming messages.  All requests and responses are strictly typed.
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
) -> Result<MessageResponse> {
    tracing::trace!("Handling message {:?}", request);

    match request {
        // User enters a room.
        MessageRequest::EnterRoom {
            user_id,
            file_id,
            first_name,
            last_name,
            image,
        } => {
            let user = User {
                id: user_id,
                first_name,
                last_name,
                image,
                socket: Some(Arc::clone(&sender)),
            };
            let user_id = user.id.clone();
            let is_new = state.enter_room(file_id, &user).await;
            let room = state.get_room(&file_id).await?;
            let response = MessageResponse::Room { room };

            // only broadcast if the user is new to the room
            if is_new {
                broadcast(user_id, file_id, Arc::clone(&state), response.clone())?;
            }

            Ok(response)
        }

        MessageRequest::LeaveRoom { user_id, file_id } => {
            let is_not_empty = state.leave_room(file_id, &user_id).await?;
            let room = state.get_room(&file_id).await?;
            let response = MessageResponse::Room { room };

            if is_not_empty {
                broadcast(user_id, file_id, Arc::clone(&state), response.clone())?
            }

            Ok(response)
        }

        // User moves their mouse
        MessageRequest::MouseMove {
            user_id,
            file_id,
            x,
            y,
        } => {
            let response = MessageResponse::MouseMove {
                user_id: user_id.clone(),
                file_id,
                x,
                y,
            };

            broadcast(user_id, file_id, Arc::clone(&state), response.clone())?;

            Ok(response)
        }

        // User changes their selection
        MessageRequest::ChangeSelection {
            user_id,
            file_id,
            selection,
        } => {
            let response = MessageResponse::ChangeSelection {
                user_id: user_id.clone(),
                file_id,
                selection,
            };

            broadcast(user_id, file_id, Arc::clone(&state), response.clone())?;

            Ok(response)
        }

        // User sends transactions
        MessageRequest::Transaction {
            user_id,
            file_id,
            operations,
        } => {
            let response = MessageResponse::Transaction {
                user_id: user_id.clone(),
                file_id,
                operations,
            };

            broadcast(user_id, file_id, Arc::clone(&state), response.clone())?;

            Ok(response)
        }
    }
}

/// Broadcast a message to all users in a room except the sender.
/// All messages are sent in a separate thread.
pub(crate) fn broadcast(
    user_id: String,
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
                // todo: this is not working :(
                .filter(|(_, user)| user_id != user.id)
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
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone()).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone()).await;
        let message = MessageResponse::MouseMove {
            user_id: user_1.id.clone(),
            file_id,
            x: Some(10f64),
            y: Some(10f64),
        };
        broadcast(user_1.id.clone(), file_id, state, message).unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_selection() {
        let state = Arc::new(State::new());
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone()).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone()).await;
        let message = MessageResponse::ChangeSelection {
            user_id: user_1.id.clone(),
            file_id,
            selection: "test".to_string(),
        };
        broadcast(user_1.id.clone(), file_id, state, message).unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_transaction() {
        let state = Arc::new(State::new());
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone()).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone()).await;
        let message = MessageResponse::Transaction {
            user_id: user_1.id.clone(),
            file_id,
            operations: "test".to_string(),
        };
        broadcast(user_1.id.clone(), file_id, state, message).unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
