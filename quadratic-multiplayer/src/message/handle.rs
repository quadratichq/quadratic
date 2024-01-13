//! Websocket Message Handler
//!
//! A central place for handling websocket messages.  This module is
//! responsible for incoming requests and outgoing responses.  Since
//! socket information is stored in the global state, we can broadcast
//! to all users in a room.

use crate::error::{MpError, Result};
use crate::get_mut_room;
use crate::message::{
    broadcast, request::MessageRequest, response::MessageResponse, send_user_message,
};
use crate::state::connection::Connection;
use crate::state::user::UserState;
use crate::state::{user::User, State};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::controller::transaction::TransactionServer;
use quadratic_rust_shared::quadratic_api::{get_file_perms, FilePermRole};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Handle incoming messages.  All requests and responses are strictly typed.
#[tracing::instrument(level = "trace")]
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    connection: &Connection,
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
            // validate that the user has permission to access the file
            let base_url = &state.settings.quadratic_api_uri;

            // anonymous users can log in without a jwt
            let jwt = connection.jwt.to_owned().unwrap_or_default();

            // default to owner for tests
            let (permissions, sequence_num) = if cfg!(test) {
                (
                    vec![
                        FilePermRole::FileEdit,
                        FilePermRole::FileView,
                        FilePermRole::FileDelete,
                    ],
                    0,
                )
            } else {
                // get permission and sequence_num from the quadratic api
                let (permissions, mut sequence_num) =
                    get_file_perms(base_url, jwt, file_id).await?;

                tracing::trace!("permissions: {:?}", permissions);

                // check for updated sequence num from the transaction queue
                // todo: this will need to be reworked to check the transaction data store
                if let Some(transaction_sequence_num) = state
                    .transaction_queue
                    .lock()
                    .await
                    .get_sequence_num(file_id)
                {
                    // replace the current sequence_num with the transaction sequence_num
                    sequence_num = transaction_sequence_num;
                }

                (permissions, sequence_num)
            };

            let user_state = UserState {
                sheet_id,
                selection,
                cell_edit,
                x: 0.0,
                y: 0.0,
                visible: false,
                code_running: "".to_string(),
                viewport,
            };

            let user = User {
                user_id,
                session_id,
                first_name,
                last_name,
                email,
                image,
                permissions,
                state: user_state,
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };

            println!("user: {:?}", user);

            let is_new = state
                .enter_room(file_id, &user, connection.id, sequence_num)
                .await?;

            // direct response to user w/sequence_num after logging in
            send_user_message(
                session_id,
                file_id,
                Arc::clone(&state),
                MessageResponse::EnterRoom {
                    file_id,
                    sequence_num,
                },
            )
            .await
            .map_err(|e| MpError::SendingMessage(e.to_string()))?;

            // only broadcast if the user is new to the room
            if is_new {
                let room = state.get_room(&file_id).await?;
                let response = MessageResponse::from(room.to_owned());

                broadcast(vec![], file_id, Arc::clone(&state), response)
                    .await
                    .map_err(|e| {
                        MpError::SendingMessage(format!(
                            "Error broadcasting to users in room {}: {}",
                            file_id, e
                        ))
                    })?;
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
                broadcast(vec![session_id], file_id, Arc::clone(&state), response);
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

            tracing::info!(
                "Transaction received for room {} from user {}",
                file_id,
                session_id
            );

            // unpack the operations or return an error
            let operations_unpacked: Vec<Operation> = serde_json::from_str(&operations)?;

            // update the room's sequence_num
            let sequence_num = get_mut_room!(state, file_id)?.increment_sequence_num();

            // broadcast the transaction to all users in the room
            let response = MessageResponse::Transaction {
                id,
                file_id,
                operations,
                sequence_num,
            };
            broadcast(vec![], file_id, Arc::clone(&state), response);

            // add the transaction to the transaction queue
            state.transaction_queue.lock().await.push_pending(
                id,
                file_id,
                operations_unpacked,
                sequence_num,
            );

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

            // todo: this will also need to get the unpending transactions to catch the client up

            // get transactions from the transaction queue
            let transactions: Vec<TransactionServer> = state
                .transaction_queue
                .lock()
                .await
                .get_pending_min_sequence_num(file_id, min_sequence_num)?
                .iter()
                .map(|t| t.to_owned())
                .collect::<Vec<_>>();

            let response = MessageResponse::Transactions {
                transactions: serde_json::to_string(&transactions)?,
            };
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

            broadcast(vec![session_id], file_id, Arc::clone(&state), response);

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

    use quadratic_core::controller::operations::operation::Operation;
    use quadratic_core::grid::SheetId;

    use super::*;
    use crate::state::user::{CellEdit, UserStateUpdate};
    use crate::test_util::{add_new_user_to_room, new_arc_state};
    use uuid::Uuid;

    async fn setup() -> (Arc<State>, Uuid, User) {
        let state = new_arc_state().await;
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
                code_running: None,
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
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
                code_running: None,
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
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
                code_running: None,
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
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
                code_running: None,
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
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
                    bold: None,
                    italic: None,
                }),
                viewport: None,
                code_running: None,
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
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
                code_running: None,
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }

    #[tokio::test]
    async fn test_change_code_running() {
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
                viewport: None,
                code_running: Some("code running".to_string()),
            },
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
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
            operations: serde_json::to_string(&vec![Operation::SetSheetColor {
                sheet_id: SheetId::new(),
                color: Some("red".to_string()),
            }])
            .unwrap(),
            sequence_num: 1,
        };
        broadcast(vec![user_1.session_id], file_id, state, message)
            .await
            .unwrap();

        // TODO(ddimaria): mock the splitsink sender to test the actual sending
    }
}
