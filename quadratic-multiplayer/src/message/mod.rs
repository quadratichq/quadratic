use anyhow::Result;
use axum::extract::ws::Message;
use futures_util::SinkExt;
use std::sync::Arc;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::message::response::MessageResponse;
use crate::state::State;

pub mod handle;
pub mod request;
pub mod response;

/// Broadcast a message to all users in a room except the sender.
/// All messages are sent in a separate thread.
pub(crate) fn broadcast(
    session_id: Uuid,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        if let Err(e) = broadcast_to_all_users(session_id, file_id, state, message).await {
            tracing::warn!("Error broadcasting message: {:?}", e.to_string());
        }
    })
}

pub(crate) async fn broadcast_to_all_users(
    session_id: Uuid,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) -> Result<()> {
    for (_, user) in state
        .get_room(&file_id)
        .await?
        .users
        .iter()
        .filter(|(_, user)| session_id != user.session_id)
    {
        println!("broadcasting to user: {:?}", user);
        if let Some(sender) = &user.socket {
            sender
                .lock()
                .await
                .send(Message::Text(serde_json::to_string(&message)?))
                .await?;
        }
    }

    Ok(())
}
