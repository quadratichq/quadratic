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
use crate::state::user::UserState;
use crate::state::{user::User, State};

/// Handle incoming messages.  All requests and responses are strictly typed.
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    connection_id: Uuid,
) -> Result<Option<MessageResponse>> {
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
            sheet_id,
            selection,
            cell_edit,
        } => {
            let user = User {
                user_id,
                session_id,
                first_name,
                last_name,
                image,
                state: UserState {
                    sheet_id,
                    selection,
                    cell_edit,
                    x: 0.0,
                    y: 0.0,
                    visible: false,
                },
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };

            let is_new = state.enter_room(file_id, &user, connection_id).await;

            // only broadcast if the user is new to the room
            if is_new {
                let session_id = user.session_id;
                let room = state.get_room(&file_id).await?;
                let response = MessageResponse::from(room.to_owned());
                broadcast(
                    Uuid::new_v4(),
                    file_id,
                    Arc::clone(&state),
                    response.clone(),
                );

                tracing::info!(
                    "User {} joined room {} with session {}",
                    user.user_id,
                    file_id,
                    session_id
                );
            }

            Ok(None)
        }

        // User leaves a room
        MessageRequest::LeaveRoom {
            session_id,
            file_id,
        } => {
            let is_not_empty = state.leave_room(file_id, &session_id).await?;
            let room = state.get_room(&file_id).await?;

            if is_not_empty {
                let response = MessageResponse::from(room.to_owned());
                broadcast(session_id, file_id, Arc::clone(&state), response.clone());
            }

            Ok(None)
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

            Ok(None)
        }

        // User sends a heartbeat
        MessageRequest::Heartbeat {
            session_id,
            file_id,
        } => {
            state.update_user_heartbeat(file_id, &session_id).await?;
            Ok(None)
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

            Ok(None)
        }

        MessageRequest::UserState {
            session_id,
            file_id,
            update,
        } => {
            state
                .update_user_state_new(&file_id, &session_id, &update)
                .await?;
            // let response = MessageResponse::UserUpdate {
            //     session_id,
            //     file_id,
            //     update,
            // };
            // broadcast(session_id, file_id, Arc::clone(&state), response.clone());

            Ok(None)
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::state::user::{CellEdit, UserState, UserStateUpdate};
    use crate::test_util::add_new_user_to_room;

    #[tokio::test]
    async fn test_update_state() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserStateUpdate {
                sheet_id: None,
                selection: Some("selection".to_string()),
                x: Some(1.0),
                y: Some(2.0),
                visible: Some(true),
                cell_edit: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_selection() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserStateUpdate {
                selection: Some("test".to_string()),
                sheet_id: None,
                x: None,
                y: None,
                visible: None,
                cell_edit: None,
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
            update: UserStateUpdate {
                selection: None,
                sheet_id: None,
                x: None,
                y: None,
                visible: Some(false),
                cell_edit: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_sheet() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserStateUpdate {
                selection: None,
                sheet_id: Some(Uuid::new_v4()),
                x: None,
                y: None,
                visible: None,
                cell_edit: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_cell_edit() {
        let state = Arc::new(State::new());
        let socket_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), socket_id).await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserStateUpdate {
                selection: None,
                sheet_id: None,
                x: None,
                y: None,
                visible: None,
                cell_edit: Some(CellEdit {
                    text: "test".to_string(),
                    cursor: 0,
                    active: true,
                }),
            },
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_transaction() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let _user_2 = add_new_user_to_room(file_id, state.clone(), connection_id).await;
        let message = MessageResponse::Transaction {
            file_id,
            operations: "test".to_string(),
        };
        broadcast(user_1.session_id, file_id, state, message);

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
