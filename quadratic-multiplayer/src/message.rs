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
    MouseMove {
        user_id: String,
        file_id: Uuid,
        x: f64,
        y: f64,
    },
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
    Room {
        room: Room,
    },
    MouseMove {
        user_id: String,
        file_id: Uuid,
        x: f64,
        y: f64,
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
            tracing::info!("user {} entered room", user.id);

            // only broadcast if the user is new to the room
            if is_new {
                broadcast(user_id, file_id, Arc::clone(&state), response.clone())?;
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
    async fn broadcasting() {
        let state = Arc::new(State::new());
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone()).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone()).await;
        let message = MessageResponse::MouseMove {
            user_id: user_1.id.clone(),
            file_id,
            x: 10 as f64,
            y: 10 as f64,
        };
        broadcast(user_1.id.clone(), file_id, state, message).unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
