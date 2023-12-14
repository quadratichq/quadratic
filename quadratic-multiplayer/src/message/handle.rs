//! Websocket Message Handler
//!
//! A central place for handling websocket messages.  This module is
//! responsible for incoming requests and outgoing responses.  Since
//! socket information is stored in the global state, we can broadcast
//! to all users in a room.

use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::message::{broadcast, request::MessageRequest, response::MessageResponse};
use crate::state::user::UserState;
use crate::state::{user::User, State};

/// Handle incoming messages.  All requests and responses are strictly typed.
#[tracing::instrument]
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
            email,
            image,
            sheet_id,
            selection,
            cell_edit,
            viewport,
        } => {
            let user_state = UserState {
                sheet_id,
                selection,
                cell_edit,
                x: 0.0,
                y: 0.0,
                visible: false,
                viewport,
            };

            let user = User {
                user_id,
                session_id,
                first_name,
                last_name,
                email,
                image,
                state: user_state,
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };

            let is_new = state.enter_room(file_id, &user, connection_id).await;

            // only broadcast if the user is new to the room
            if is_new {
                let session_id = user.session_id;
                let room = state.get_room(&file_id).await?;
                let response = MessageResponse::from(room.to_owned());

                broadcast(Uuid::new_v4(), file_id, Arc::clone(&state), response);

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
                broadcast(session_id, file_id, Arc::clone(&state), response);
            }

            Ok(None)
        }

        // User sends transactions
        MessageRequest::Transaction {
            id,
            session_id,
            file_id,
            operations,
        } => {
            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;

            // add the transaction to the transaction queue
            let sequence_num = state.transaction_queue.lock().await.push(
                id,
                file_id,
                serde_json::from_str(&operations)?,
            );

            let response = MessageResponse::Transaction {
                id,
                file_id,
                operations,
                sequence_num,
            };

            broadcast(session_id, file_id, Arc::clone(&state), response);

            Ok(None)
        }

        // User sends transactions
        MessageRequest::GetTransactions {
            file_id,
            session_id,
            min_sequence_num,
        } => {
            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;

            // get transactions from the transaction queue
            let transactions = state
                .transaction_queue
                .lock()
                .await
                .get_transactions_min_sequence_num(file_id, min_sequence_num)?;

            let response = MessageResponse::Transactions { transactions };

            Ok(Some(response))
        }

        MessageRequest::UserUpdate {
            session_id,
            file_id,
            update,
        } => {
            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;

            // update user state
            state
                .update_user_state(&file_id, &session_id, &update)
                .await?;
            let response = MessageResponse::UserUpdate {
                session_id,
                file_id,
                update,
            };

            broadcast(session_id, file_id, Arc::clone(&state), response);

            Ok(None)
        }

        // User sends a heartbeat
        MessageRequest::Heartbeat {
            session_id,
            file_id,
        } => {
            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;
            Ok(None)
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::state::user::{CellEdit, UserStateUpdate};
    use crate::test_util::add_new_user_to_room;

    async fn setup() -> (Arc<State>, Uuid, User) {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let user_1 = add_new_user_to_room(file_id, state.clone(), connection_id).await;

        (state, file_id, user_1)
    }

    #[tokio::test]
    async fn test_update_state() {
        let (state, file_id, user_1) = setup().await;
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
                viewport: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_selection() {
        let (state, file_id, user_1) = setup().await;
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
                viewport: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_visibility() {
        let (state, file_id, user_1) = setup().await;
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
                viewport: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_sheet() {
        let (state, file_id, user_1) = setup().await;
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
                viewport: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_cell_edit() {
        let (state, file_id, user_1) = setup().await;
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
                    code_editor: false,
                }),
                viewport: None,
            },
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_viewport() {
        let (state, file_id, user_1) = setup().await;
        let message = MessageResponse::UserUpdate {
            session_id: user_1.session_id,
            file_id,
            update: UserStateUpdate {
                selection: None,
                sheet_id: None,
                x: None,
                y: None,
                visible: None,
                cell_edit: None,
                viewport: Some("viewport".to_string()),
            },
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_transaction() {
        let (state, file_id, user_1) = setup().await;
        let id = Uuid::new_v4();
        let message = MessageResponse::Transaction {
            id,
            file_id,
            operations: "test".to_string(),
            sequence_num: 1,
        };
        broadcast(user_1.session_id, file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
