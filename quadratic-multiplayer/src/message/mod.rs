use axum::extract::ws::Message;
use futures_util::SinkExt;
use proto::response::encode_message;
use std::sync::Arc;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::error::MpError;
use crate::state::State;
use quadratic_rust_shared::multiplayer::message::response::MessageResponse;

pub mod handle;
pub mod proto;

/// Broadcast a message to all users in a room except the sender.
/// All messages are sent in a separate thread.
#[tracing::instrument(level = "trace")]
pub(crate) fn broadcast(
    exclude: Vec<Uuid>,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) -> JoinHandle<()> {
    tracing::trace!(
        "Broadcasting message to room {}, excluding {:?}: {:?}",
        file_id,
        exclude,
        message
    );

    tokio::spawn(async move {
        if let Ok(room) = state.get_room(&file_id).await {
            let result = async {
                let included_users = room
                    .users
                    .iter()
                    .filter(|user| !exclude.contains(&user.session_id));

                if included_users.clone().count() == 0 {
                    return Ok::<_, MpError>(());
                }

                let send_message = match message.is_binary() {
                    true => {
                        let serialized_message = encode_message(message)?;
                        Message::Binary(serialized_message.into())
                    }
                    false => {
                        let serialized_message = serde_json::to_string(&message)?;
                        Message::Text(serialized_message.into())
                    }
                };

                for user in included_users {
                    if let Some(sender) = &user.socket {
                        let sent = sender
                            .lock()
                            .await
                            .send(send_message.to_owned())
                            .await
                            .map_err(|e| MpError::SendingMessage(e.to_string()));

                        if let Err(error) = sent {
                            tracing::warn!(
                                "Error broadcasting to user {} in room {}: {:?}",
                                user.session_id,
                                file_id,
                                error,
                            );

                            // the user's socket is stale, so remove them from the room
                            state.leave_room(file_id, &user.session_id).await?;
                        }
                    }
                }

                Ok::<_, MpError>(())
            };

            if let Err(e) = result.await {
                tracing::warn!("Error broadcasting message: {:?}", e.to_string());
            }
        }
    })
}

/// Send a message to a specific user in a room.
/// All messages are sent in a separate thread.
#[tracing::instrument(level = "trace")]
pub(crate) fn send_user_message(
    session_id: Uuid,
    file_id: Uuid,
    state: Arc<State>,
    message: MessageResponse,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let result = async {
            if let Ok(user) = state.get_room(&file_id).await?.get_user(&session_id) {
                if let Some(sender) = &user.socket {
                    sender
                        .lock()
                        .await
                        .send(Message::Text(serde_json::to_string(&message)?.into()))
                        .await
                        .map_err(|e| MpError::SendingMessage(e.to_string()))?;
                }
                Ok::<_, MpError>(())
            } else {
                Err(MpError::UserNotFound(session_id, file_id))
            }
        };

        if let Err(e) = result.await {
            tracing::warn!("Error sending a message: {:?}", e.to_string());
        }
    })
}
