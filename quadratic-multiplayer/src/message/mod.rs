use axum::extract::ws::Message;
use futures_util::SinkExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::error::MpError;
use crate::message::response::MessageResponse;
use crate::state::State;

pub mod handle;
pub mod request;
pub mod response;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub(crate) struct CellEdit {
    pub active: bool,
    pub text: String,
    pub cursor: u32,
    pub code_editor: bool,
    pub inline_code_editor: bool,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct UserState {
    pub sheet_id: Uuid,
    pub selection: String,
    pub code_running: String,
    pub cell_edit: CellEdit,
    pub x: f64,
    pub y: f64,
    pub visible: bool,
    pub viewport: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub(crate) struct UserStateUpdate {
    pub sheet_id: Option<Uuid>,
    pub selection: Option<String>,
    pub cell_edit: Option<CellEdit>,
    pub code_running: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub visible: Option<bool>,
    pub viewport: Option<String>,
}

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

                let serialized_message = serde_json::to_string(&message)?;

                for user in included_users {
                    if let Some(sender) = &user.socket {
                        let sent = sender
                            .lock()
                            .await
                            .send(Message::Text(serialized_message.clone()))
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
                        .send(Message::Text(serde_json::to_string(&message)?))
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
