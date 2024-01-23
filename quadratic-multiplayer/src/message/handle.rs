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
use crate::permissions::{
    validate_can_edit_or_view_file, validate_user_can_edit_file,
    validate_user_can_edit_or_view_file,
};
use crate::state::connection::PreConnection;
use crate::state::transaction_queue::GROUP_NAME;
use crate::state::user::UserState;
use crate::state::{user::User, State};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_core::controller::transaction::TransactionServer;
use quadratic_rust_shared::pubsub::PubSub;
use quadratic_rust_shared::quadratic_api::{get_file_perms, FilePermRole};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Handle incoming messages.  All requests and responses are strictly typed.
#[tracing::instrument(level = "trace")]
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    pre_connection: PreConnection,
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
            let jwt = pre_connection.jwt.to_owned().unwrap_or_default();

            // default to all roles for tests
            let (permissions, sequence_num) = if cfg!(test) {
                (vec![FilePermRole::FileEdit, FilePermRole::FileView], 0)
            } else {
                // get permission and sequence_num from the quadratic api
                let (permissions, mut sequence_num) =
                    get_file_perms(base_url, jwt, file_id).await?;

                tracing::trace!("permissions: {:?}", permissions);

                // TODO(ddimaria): break out any pubsub work into a separate file
                if let Ok(pubsub_sequence_num) = state
                    .transaction_queue
                    .lock()
                    .await
                    .pubsub
                    .connection
                    .last_message(&file_id.to_string())
                    .await
                {
                    // ignore parsing errors for now
                    let pubsub_sequence_num =
                        pubsub_sequence_num.0.parse::<u64>().unwrap_or(sequence_num);
                    sequence_num = sequence_num.max(pubsub_sequence_num);
                }

                (permissions, sequence_num)
            };

            validate_can_edit_or_view_file(&permissions)?;

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
                connection_id: pre_connection.id,
                first_name,
                last_name,
                email,
                image,
                permissions,
                state: user_state,
                socket: Some(Arc::clone(&sender)),
                last_heartbeat: chrono::Utc::now(),
            };

            // subscribe to the file's pubsub channel
            // TODO(ddimaria): break out any pubsub work into a separate file
            if let Err(error) = state
                .transaction_queue
                .lock()
                .await
                .pubsub
                .connection
                .subscribe(&file_id.to_string(), GROUP_NAME)
                .await
            {
                tracing::info!("Error subscribing to pubsub channel: {}", error);
            };

            let is_new = state
                .enter_room(file_id, &user, pre_connection, sequence_num)
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
            validate_user_can_edit_or_view_file(Arc::clone(&state), file_id, session_id).await?;

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
            validate_user_can_edit_file(Arc::clone(&state), file_id, session_id).await?;

            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;

            // tracing::info!(
            //     "Transaction received for room {} from user {}",
            //     file_id,
            //     session_id
            // );

            // unpack the operations or return an error
            let operations_unpacked: Vec<Operation> = serde_json::from_str(&operations)?;

            // get the room's sequence_num
            let room_sequence_num = get_mut_room!(state, file_id)?.increment_sequence_num();

            // add the transaction to the transaction queue
            let sequence_num = state
                .transaction_queue
                .lock()
                .await
                .push_pending(id, file_id, operations_unpacked, room_sequence_num)
                .await;

            // broadcast the transaction to all users in the room
            let response = MessageResponse::Transaction {
                id,
                file_id,
                operations,
                sequence_num,
            };
            broadcast(vec![], file_id, Arc::clone(&state), response);

            Ok(None)
        }

        // User sends transactions
        MessageRequest::GetTransactions {
            file_id,
            session_id,
            min_sequence_num,
        } => {
            validate_user_can_edit_or_view_file(Arc::clone(&state), file_id, session_id).await?;

            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;

            // TODO(ddimaria): break out any pubsub work into a separate file
            let transactions = state
                .transaction_queue
                .lock()
                .await
                .pubsub
                .connection
                .get_messages_from(&file_id.to_string(), &min_sequence_num.to_string())
                .await?
                .iter()
                .flat_map(|(_, message)| serde_json::from_str::<TransactionServer>(message))
                .collect::<Vec<TransactionServer>>();

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
            validate_user_can_edit_or_view_file(Arc::clone(&state), file_id, session_id).await?;

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
            validate_user_can_edit_or_view_file(Arc::clone(&state), file_id, session_id).await?;

            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;
            Ok(None)
        }
    }
}

#[cfg(test)]
pub(crate) mod tests {

    use std::cell;

    use quadratic_core::controller::operations::operation::Operation;
    use quadratic_core::grid::SheetId;
    use tokio::net::TcpStream;
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

    use super::*;
    use crate::state::user::{CellEdit, UserStateUpdate};
    use crate::test_util::{
        add_user_via_ws, integration_test_receive_typed, new_connection, setup,
    };
    use uuid::Uuid;

    async fn test_handle(
        socket: Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
        state: Arc<State>,
        file_id: Uuid,
        user: User,
        request: MessageRequest,
        response: Option<MessageResponse>,
        broadcast_response: MessageResponse,
    ) {
        // add another user so that we can test broadcasting
        let user_2 = add_user_via_ws(file_id, socket.clone()).await;
        new_connection(socket.clone(), file_id, user_2.clone()).await;

        let stream = state
            ._get_user_in_room(&file_id, &user.session_id)
            .await
            .unwrap()
            .socket
            .unwrap();

        let handled = handle_message(request, state.clone(), stream, PreConnection::new(None))
            .await
            .unwrap();
        assert_eq!(handled, response);

        let received = integration_test_receive_typed(&socket, 1).await.unwrap();
        assert_eq!(received, broadcast_response);
    }

    #[tokio::test]
    async fn handle_user_update() {
        let (socket, state, _, file_id, user) = setup().await;
        let sheet_id = Some(Uuid::new_v4());
        let selection = Some("selection".to_string());
        let x = Some(1.0);
        let y = Some(1.0);
        let visible = Some(true);
        let cell_edit = Some(CellEdit::default());
        let viewport = Some("viewport".to_string());
        let code_running = Some("code_running".to_string());

        let request = MessageRequest::UserUpdate {
            session_id: user.session_id,
            file_id,
            update: UserStateUpdate {
                sheet_id,
                selection: selection.clone(),
                x,
                y,
                visible,
                cell_edit: cell_edit.clone(),
                viewport: viewport.clone(),
                code_running: code_running.clone(),
            },
        };

        let response = MessageResponse::UserUpdate {
            session_id: user.session_id,
            file_id,
            update: UserStateUpdate {
                sheet_id,
                selection: selection.clone(),
                x,
                y,
                visible,
                cell_edit,
                viewport,
                code_running,
            },
        };

        test_handle(socket, state, file_id, user, request, None, response).await;
    }

    #[tokio::test]
    async fn handle_transaction() {
        let (socket, state, _, file_id, user) = setup().await;
        let id = Uuid::new_v4();
        let session_id = user.session_id;
        let operations = serde_json::to_string(&vec![Operation::SetSheetColor {
            sheet_id: SheetId::new(),
            color: Some("red".to_string()),
        }])
        .unwrap();

        let request = MessageRequest::Transaction {
            id,
            file_id,
            session_id,
            operations: operations.clone(),
        };

        let response = MessageResponse::Transaction {
            id,
            file_id,
            operations,
            sequence_num: 1,
        };

        test_handle(socket, state, file_id, user, request, None, response).await;
    }
}
