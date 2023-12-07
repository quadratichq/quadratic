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
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::message::{broadcast, request::MessageRequest, response::MessageResponse};
use crate::state::{user::User, State};

/// Handle incoming messages.  All requests and responses are strictly typed.
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    socket_id: Uuid,
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
                state: Default::default(),
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };
            let session_id = user.session_id;
            let is_new = state.enter_room(file_id, &user, socket_id).await;
            let room = state.get_room(&file_id).await?;
            let response = MessageResponse::from(room.to_owned());

            // only broadcast if the user is new to the room
            if is_new {
                broadcast(session_id, file_id, Arc::clone(&state), response.clone());

                tracing::info!(
                    "User {} joined room {} with session {}",
                    user.user_id,
                    file_id,
                    session_id
                );
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
            state.update_user_heartbeat(file_id, &session_id).await?;
            let response = MessageResponse::Transaction {
                file_id,
                operations,
            };

            broadcast(session_id, file_id, Arc::clone(&state), response.clone());

            Ok(response)
        }

        // User sends a heartbeat
        MessageRequest::Heartbeat {
            session_id,
            file_id,
        } => {
            state.update_user_heartbeat(file_id, &session_id).await?;
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

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::state::user::UserState;
    use crate::test_util::add_new_user_to_room;

    #[tokio::test]
    async fn test_update_state() {
        let state = Arc::new(State::new());
        let socket_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserState {
                sheet_id: Some(Uuid::new_v4()),
                selection: Some("selection".to_string()),
                x: Some(1.0),
                y: Some(2.0),
                visible: Some(true),
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_selection() {
        let state = Arc::new(State::new());
        let socket_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserState {
                selection: Some("test".to_string()),
                sheet_id: None,
                x: None,
                y: None,
                visible: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_visibility() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), internal_session_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserState {
                selection: None,
                sheet_id: None,
                x: None,
                y: None,
                visible: Some(false),
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_sheet() {
        let state = Arc::new(State::new());
        let socket_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserState {
                selection: None,
                sheet_id: Some(Uuid::new_v4()),
                x: None,
                y: None,
                visible: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_transaction() {
        let state = Arc::new(State::new());
        let socket_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let message = MessageResponse::Transaction {
            file_id,
            operations: "test".to_string(),
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
