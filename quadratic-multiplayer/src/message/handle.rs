//! Websocket Message Handler
//!
//! A central place for handling websocket messages.  This module is
//! responsible for incoming requests and outgoing responses.  Since
//! socket information is stored in the global state, we can broadcast
//! to all users in a room.

use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use quadratic_core::controller::operations::operation::Operation;
use quadratic_rust_shared::quadratic_api::{get_file_perms, FilePermRole};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{ErrorLevel, MpError, Result};
use crate::get_mut_room;
use crate::message::{
    broadcast, request::MessageRequest, response::MessageResponse, send_user_message,
};
use crate::permissions::{
    validate_can_edit_or_view_file, validate_user_can_edit_file,
    validate_user_can_edit_or_view_file,
};
use crate::state::{
    connection::PreConnection,
    pubsub::GROUP_NAME,
    user::{User, UserState},
    State,
};

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
            follow,
        } => {
            // validate that the user has permission to access the file
            let base_url = &state.settings.quadratic_api_uri;

            // anonymous users can log in without a jwt
            let jwt = pre_connection.jwt.to_owned().unwrap_or_default();

            // default to all roles for tests
            let (permissions, sequence_num) = if cfg!(test) {
                (vec![FilePermRole::FileView, FilePermRole::FileEdit], 0)
            } else {
                // get permission and sequence_num from the quadratic api
                let (permissions, mut sequence_num) =
                    get_file_perms(base_url, jwt, file_id).await?;

                tracing::trace!("permissions: {:?}", permissions);

                if let Ok(pubsub_sequence_num) = state.get_last_message_pubsub(&file_id).await {
                    // ignore parsing errors for now
                    let pubsub_sequence_num =
                        pubsub_sequence_num.0.parse::<u64>().unwrap_or(sequence_num);
                    sequence_num = sequence_num.max(pubsub_sequence_num);
                }

                (permissions, sequence_num)
            };

            validate_can_edit_or_view_file(&permissions)?;

            let follow = follow.map(|follow| Uuid::parse_str(&follow).unwrap_or_default());
            let user_state = UserState {
                sheet_id,
                selection,
                cell_edit,
                x: 0.0,
                y: 0.0,
                visible: false,
                code_running: "".to_string(),
                viewport,
                follow,
            };

            let mut user = User {
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

                // this will be properly set in the enter_room function
                index: 0,
            };

            // subscribe to the file's pubsub channel
            if let Err(error) = state.subscribe_pubsub(&file_id, GROUP_NAME).await {
                tracing::info!("Error subscribing to pubsub channel: {}", error);
            };

            let is_new = state
                .enter_room(file_id, &mut user, pre_connection, sequence_num)
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
                let response = MessageResponse::from((room.users, &state.settings.min_version));

                broadcast(vec![], file_id, Arc::clone(&state), response);
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
                let response = MessageResponse::from((room.users, &state.settings.min_version));
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

            tracing::trace!(
                "Transaction received for room {} from user {}",
                file_id,
                session_id
            );

            // // unpack the operations or return an error
            // let operations_unpacked: Vec<Operation> = serde_json::from_str(&operations)?;

            // get and increment the room's sequence_num
            let room_sequence_num = get_mut_room!(state, file_id)?.increment_sequence_num();

            // add the transaction to the transaction queue
            let sequence_num = state
                .push_pubsub(id, file_id, operations.clone(), room_sequence_num)
                .await?;

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

            let sequence_num = state.get_sequence_num(&file_id).await?;

            // calculate the expected number of transactions to get from redis
            // add 1 to include the min_sequence_num (inclusive range)
            let expected_num_transactions = sequence_num
                .checked_sub(min_sequence_num)
                .unwrap_or_default()
                + 1;

            tracing::warn!("min_sequence_num: {}", min_sequence_num);
            tracing::warn!("sequence_num: {}", sequence_num);
            tracing::warn!("expected_num_transactions: {}", expected_num_transactions);

            let transactions = state
                .get_messages_from_pubsub(&file_id, min_sequence_num)
                .await?;

            tracing::warn!("got: {}", transactions.len());

            // we don't have the expected number of transactions
            // send an error to the client so they can reload
            if transactions.len() < expected_num_transactions as usize {
                return Ok(Some(MessageResponse::Error {
                    error: MpError::MissingTransactions(
                        expected_num_transactions.to_string(),
                        transactions.len().to_string(),
                    ),
                    error_level: ErrorLevel::Error,
                }));
            }

            let response = MessageResponse::Transactions { transactions };

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
    use quadratic_core::controller::operations::operation::Operation;
    use quadratic_core::controller::transaction::Transaction;
    use quadratic_core::grid::SheetId;
    use tokio::net::TcpStream;
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
    use uuid::Uuid;

    use super::*;
    use crate::state::settings::MinVersion;
    use crate::state::user::{CellEdit, UserStateUpdate};
    use crate::test_util::{integration_test_receive, new_user, setup};

    async fn test_handle(
        socket: Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
        state: Arc<State>,
        file_id: Uuid,
        user_1: User,
        request: MessageRequest,
        response: Option<MessageResponse>,
        broadcast_response: Option<MessageResponse>,
    ) {
        let stream = state
            ._get_user_in_room(&file_id, &user_1.session_id)
            .await
            .unwrap()
            .socket
            .unwrap();

        let handled = handle_message(request, state.clone(), stream, PreConnection::new(None))
            .await
            .unwrap();
        assert_eq!(handled, response);

        if let Some(broadcast_response) = broadcast_response {
            let received = integration_test_receive(&socket, 2).await.unwrap();
            assert_eq!(received, broadcast_response);
        }
    }

    #[tokio::test]
    async fn handle_user_update() {
        let (socket, state, _, file_id, user_1, _) = setup().await;
        let session_id = user_1.session_id;

        let update = UserStateUpdate {
            sheet_id: Some(Uuid::new_v4()),
            selection: Some("selection".to_string()),
            x: Some(1.0),
            y: Some(2.0),
            visible: Some(true),
            cell_edit: Some(CellEdit::default()),
            viewport: Some("viewport".to_string()),
            code_running: Some("code_running".to_string()),
            follow: Some(Uuid::new_v4().to_string()),
        };

        let request = MessageRequest::UserUpdate {
            session_id,
            file_id,
            update: update.clone(),
        };

        let response = MessageResponse::UserUpdate {
            session_id,
            file_id,
            update,
        };

        test_handle(
            socket,
            state,
            file_id,
            user_1,
            request,
            None,
            Some(response),
        )
        .await;
    }

    #[tokio::test]
    async fn handle_enter_room() {
        let (socket, state, _, file_id, user_1, _) = setup().await;
        let user = new_user();

        let request = MessageRequest::EnterRoom {
            file_id,
            session_id: user.session_id,
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            image: user.image,
            sheet_id: Uuid::new_v4(),
            selection: "selection".into(),
            cell_edit: CellEdit::default(),
            viewport: "viewport".into(),
            follow: Some(Uuid::new_v4().to_string()),
        };

        let response = MessageResponse::EnterRoom {
            file_id,
            sequence_num: 0,
        };

        let users_in_room = state.get_room(&file_id).await.unwrap().users;
        assert_eq!(users_in_room.len(), 2);

        test_handle(
            socket,
            state.clone(),
            file_id,
            user_1,
            request,
            None,
            Some(response),
        )
        .await;

        let users_in_room = state.get_room(&file_id).await.unwrap().users;
        assert_eq!(users_in_room.len(), 3);
    }

    #[tokio::test]
    async fn handle_leave_room() {
        let (socket, state, _, file_id, user_1, user_2) = setup().await;
        let session_id = user_1.session_id;

        let request = MessageRequest::LeaveRoom {
            file_id,
            session_id,
        };

        let response = MessageResponse::UsersInRoom {
            users: vec![user_2.clone()],
            min_version: MinVersion::new().unwrap(),
        };

        let users_in_room = state.get_room(&file_id).await.unwrap().users;
        assert_eq!(users_in_room.len(), 2);

        test_handle(
            socket,
            state.clone(),
            file_id,
            user_1,
            request,
            None,
            Some(response),
        )
        .await;

        let users_in_room = state.get_room(&file_id).await.unwrap().users;
        assert_eq!(users_in_room.len(), 1);
    }

    #[tokio::test]
    async fn handle_set_and_get_transactions() {
        let (socket, state, _, file_id, user_1, _) = setup().await;
        let id = Uuid::new_v4();
        let session_id = user_1.session_id;
        let operations = vec![Operation::SetSheetColor {
            sheet_id: SheetId::new(),
            color: Some("red".to_string()),
        }];
        let compressed_ops = Transaction::serialize_and_compress(&operations).unwrap();

        let request = MessageRequest::Transaction {
            id,
            file_id,
            session_id,
            operations: compressed_ops.clone(),
        };

        let response = MessageResponse::Transaction {
            id,
            file_id,
            operations: compressed_ops.clone(),
            sequence_num: 1,
        };

        test_handle(
            socket.clone(),
            state.clone(),
            file_id,
            user_1.clone(),
            request,
            None,
            Some(response.clone()),
        )
        .await;

        // now test get_transactions
        let request = MessageRequest::GetTransactions {
            file_id,
            session_id,
            min_sequence_num: 1,
        };

        // let string_operations = compressed_ops;
        // let response = MessageResponse::Transactions {
        //     transactions: format!("[{{\"id\":\"{id}\",\"file_id\":\"{file_id}\",\"operations\":{string_operations},\"sequence_num\":1}}]"),
        // };

        // expect an empty array since there are no transactions
        test_handle(
            socket,
            state,
            file_id,
            user_1,
            request,
            Some(response),
            None,
        )
        .await;
    }

    #[tokio::test]
    async fn handle_missing_transactions() {
        let (socket, state, _, file_id, user_1, _) = setup().await;
        let session_id = user_1.session_id;

        let request = MessageRequest::GetTransactions {
            file_id,
            session_id,
            min_sequence_num: 1,
        };

        // increment the sequence_num
        get_mut_room!(state, file_id)
            .unwrap()
            .increment_sequence_num();

        let response = MessageResponse::Error {
            error: MpError::MissingTransactions("1".into(), "0".into()), // requested 1, got 0
            error_level: ErrorLevel::Error,
        };

        // expect an error since we're requesting a higher sequence_num
        test_handle(
            socket,
            state,
            file_id,
            user_1,
            request,
            Some(response),
            None,
        )
        .await;
    }
}
