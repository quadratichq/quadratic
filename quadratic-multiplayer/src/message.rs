use std::sync::Arc;

use anyhow::{anyhow, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use futures_util::SinkExt;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::state::{Room, State, User};

#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum MessageRequest {
    EnterRoom {
        user_id: Uuid,
        file_id: Uuid,
        first_name: String,
        last_name: String,
        image: String,
    },
    MouseMove {
        user_id: Uuid,
        x: f64,
        y: f64,
    },
}

#[derive(Serialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum MessageResponse {
    Empty,
    Room { room: Room },
    MouseMove { user_id: Uuid, x: f64, y: f64 },
}

pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
) -> Result<MessageResponse> {
    tracing::trace!("Handling message {:?}", request);

    match request {
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
                socket: Arc::clone(&sender),
            };

            state.enter_room(file_id, user).await;
            broadcast(file_id, Arc::clone(&state)).await?;

            Ok(MessageResponse::Empty)
            // Ok(MessageResponse::Room {
            //     room: state
            //         .rooms
            //         .lock()
            //         .await
            //         .get(&file_id)
            //         .ok_or(anyhow!("Room {file_id} not found"))?
            //         .clone(),
            // })
        }
        MessageRequest::MouseMove { user_id, x, y } => {
            Ok(MessageResponse::MouseMove { user_id, x, y })
        }
    }
}

pub(crate) async fn broadcast(file_id: Uuid, state: Arc<State>) -> Result<()> {
    let room = state
        .rooms
        .lock()
        .await
        .get(&file_id)
        .ok_or(anyhow!("Room {file_id} not found"))?
        .clone();

    let response = MessageResponse::Room { room: room.clone() };

    for (_, user) in room.users.iter() {
        (*user.socket.lock().await)
            .send(Message::Text(serde_json::to_string(&response)?))
            .await?;
    }

    Ok(())
}
