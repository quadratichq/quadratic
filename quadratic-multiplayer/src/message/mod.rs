use axum::extract::ws::Message;
use futures_util::SinkExt;
use std::sync::Arc;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::error::MpError;
use crate::message::response::MessageResponse;
use crate::state::State;

pub mod handle;
pub mod request;
pub mod response;

/// Broadcast a message to all users in a room except the sender.
/// All messages are sent in a separate thread.
#[tracing::instrument(level = "trace")]
pub(crate) fn broadcast(
    exclude: Vec<Uuid>,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) -> JoinHandle<()> {
    // println!("message: {:?}", message);
    tokio::spawn(async move {
        let result = async {
            for (_, user) in state
                .get_room(&file_id)
                .await?
                .users
                .iter()
                .filter(|(_, user)| !exclude.contains(&user.session_id))
            {
                if let Some(sender) = &user.socket {
                    sender
                        .lock()
                        .await
                        .send(Message::Text(serde_json::to_string(&message)?))
                        .await
                        .map_err(|e| MpError::SendingMessage(e.to_string()))?;
                }
            }

            Ok::<_, MpError>(())
        };

        if let Err(e) = result.await {
            tracing::warn!("Error broadcasting message: {:?}", e.to_string());
        }
    })
}
