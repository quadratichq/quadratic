//! Websocket Message Handler
//!
//! A central place for handling websocket messages.  This module is
//! responsible for incoming requests and outgoing responses.  Since
//! socket information is stored in the global state, we can broadcast
//! to all users in a room.

use base64::{Engine, engine::general_purpose::STANDARD};
use quadratic_rust_shared::ErrorLevel;
use quadratic_rust_shared::auth::jwt::decode_claims_unverified;
use quadratic_rust_shared::multiplayer::message::response::{
    BinaryTransaction, ResponseError, Transaction,
};
use quadratic_rust_shared::multiplayer::message::{
    UserState, request::MessageRequest, response::MessageResponse,
};
use quadratic_rust_shared::net::websocket_server::pre_connection::PreConnection;
use quadratic_rust_shared::quadratic_api::{ADMIN_PERMS, get_file_perms};
use std::sync::Arc;
use uuid::Uuid;

/// Validate that the file_id in the JWT matches the requested file_id.
/// Only applies to M2M connections (workers) that have a JWT with file_id claim.
fn validate_jwt_file_id(pre_connection: &PreConnection, requested_file_id: Uuid) -> Result<()> {
    // Only validate for M2M connections with a JWT
    if !pre_connection.is_m2m() {
        return Ok(());
    }

    let jwt = match &pre_connection.jwt {
        Some(jwt) => jwt,
        None => return Ok(()), // No JWT to validate
    };

    let claims = decode_claims_unverified(jwt)
        .map_err(|e| MpError::Authentication(format!("Failed to decode JWT claims: {}", e)))?;

    match claims.file_id {
        Some(jwt_file_id) if jwt_file_id == requested_file_id => Ok(()),
        Some(jwt_file_id) => Err(MpError::Authentication(format!(
            "JWT file_id {} does not match requested file_id {}",
            jwt_file_id, requested_file_id
        ))),
        None => Err(MpError::Authentication(
            "JWT missing file_id claim".to_string(),
        )),
    }
}

use crate::error::{MpError, Result};
use crate::get_mut_room;
use crate::message::{broadcast, send_user_message};
use crate::permissions::{
    validate_can_edit_or_view_file, validate_user_can_edit_file,
    validate_user_can_edit_or_view_file,
};
use crate::state::user::UserSocket;
use crate::state::{State, pubsub::GROUP_NAME, user::User};

/// Handle incoming messages.  All requests and responses are strictly typed.
#[tracing::instrument(level = "trace")]
pub(crate) async fn handle_message(
    request: MessageRequest,
    state: Arc<State>,
    sender: UserSocket,
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
            // For M2M connections (workers), validate that the JWT file_id matches
            validate_jwt_file_id(&pre_connection, file_id)?;

            // validate that the user has permission to access the file
            let base_url = &state.settings.quadratic_api_uri;

            // For M2M connections (workers), use multiplayer's M2M token for API calls.
            // For regular users, use their JWT.
            let (jwt, m2m_token) = if pre_connection.is_m2m() {
                (String::new(), Some(state.settings.m2m_auth_token.as_str()))
            } else {
                (pre_connection.jwt.to_owned().unwrap_or_default(), None)
            };

            // default to all roles for tests
            let (permissions, sequence_num) = if cfg!(test) {
                (ADMIN_PERMS.to_vec(), 0)
            } else {
                // get permission and sequence_num from the quadratic api
                let (permissions, mut sequence_num) =
                    get_file_perms(base_url, jwt, file_id, m2m_token).await?;

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
            // response is the variant MessageResponse::UsersInRoom
            if is_new {
                let room = state.get_room(&file_id).await?;
                let response = room.to_users_in_room_response(&state.settings.version);

                broadcast(vec![], file_id, Arc::clone(&state), response);
            }

            // send the current transaction to the user
            let response = MessageResponse::CurrentTransaction { sequence_num };

            Ok(Some(response))
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
                let response = room.to_users_in_room_response(&state.settings.version);
                broadcast(vec![session_id], file_id, Arc::clone(&state), response);
            }

            Ok(None)
        }

        // User sends transactions
        // TODO(ddimaria): remove this once all clients are updated
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
                "Transaction received for room {} from user {}, operations: {:?}",
                file_id,
                session_id,
                &operations
            );

            // get and increment the room's sequence_num
            let room_sequence_num = get_mut_room!(state, file_id)?.increment_sequence_num();
            let decoded_operations = STANDARD.decode(&operations).map_err(|e| {
                MpError::Serialization(format!(
                    "Could not decode base64 encoded operations in transaction {id}: {e:?}"
                ))
            })?;

            // add the transaction to the transaction queue
            let sequence_num = state
                .push(id, file_id, decoded_operations, room_sequence_num)
                .await?;

            // broadcast the transaction to all users in the room (except the initiator)
            let response = MessageResponse::Transaction {
                id,
                file_id,
                sequence_num,
                operations,
            };
            broadcast(vec![session_id], file_id, Arc::clone(&state), response);

            // send an ack to the initiator
            let response = MessageResponse::TransactionAck {
                id,
                file_id,
                sequence_num,
            };

            Ok(Some(response))
        }

        // User sends binary transaction
        MessageRequest::BinaryTransaction {
            id,
            session_id,
            file_id,
            operations,
        } => {
            validate_user_can_edit_file(Arc::clone(&state), file_id, session_id).await?;

            // update the heartbeat
            state.update_user_heartbeat(file_id, &session_id).await?;

            tracing::trace!(
                "Transaction received for room {} from user {}, operations: {:?}",
                file_id,
                session_id,
                &operations
            );

            // get and increment the room's sequence_num
            let room_sequence_num = get_mut_room!(state, file_id)?.increment_sequence_num();

            // add the transaction to the transaction queue
            // we need to clone operations since we broadcast it later
            let start_push_pubsub = std::time::Instant::now();
            let sequence_num = state
                .push(id, file_id, operations.to_owned(), room_sequence_num)
                .await?;
            tracing::trace!("Pushed to pubsub in {:?}", start_push_pubsub.elapsed());

            // broadcast the transaction to all users in the room (except the initiator)
            let response = MessageResponse::BinaryTransaction {
                id,
                file_id,
                sequence_num,
                operations,
            };
            broadcast(vec![session_id], file_id, Arc::clone(&state), response);

            // send an ack to the initiator
            let response = MessageResponse::TransactionAck {
                id,
                file_id,
                sequence_num,
            };

            Ok(Some(response))
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

            tracing::trace!("min_sequence_num: {}", min_sequence_num);
            tracing::trace!("sequence_num: {}", sequence_num);
            tracing::trace!("expected_num_transactions: {}", expected_num_transactions);

            let transactions = state
                .get_messages_from_pubsub(&file_id, min_sequence_num)
                .await?
                .into_iter()
                .map(|transaction| Transaction {
                    id: transaction.id,
                    file_id: transaction.file_id,
                    sequence_num: transaction.sequence_num,
                    operations: STANDARD.encode(&transaction.operations),
                })
                .collect::<Vec<Transaction>>();

            tracing::trace!("got: {}", transactions.len());

            // we don't have the expected number of transactions
            // send an error to the client so they can reload
            if transactions.len() < expected_num_transactions as usize {
                return Ok(Some(MessageResponse::Error {
                    error: ResponseError::MissingTransactions(
                        expected_num_transactions.to_string(),
                        transactions.len().to_string(),
                    ),
                    error_level: ErrorLevel::Error,
                }));
            }

            let response = MessageResponse::Transactions { transactions };

            Ok(Some(response))
        }

        // User sends binary transactions
        MessageRequest::GetBinaryTransactions {
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

            tracing::trace!("min_sequence_num: {}", min_sequence_num);
            tracing::trace!("sequence_num: {}", sequence_num);
            tracing::trace!("expected_num_transactions: {}", expected_num_transactions);

            let transactions = state
                .get_messages_from_pubsub(&file_id, min_sequence_num)
                .await?
                .into_iter()
                .map(|transaction| BinaryTransaction {
                    id: transaction.id,
                    file_id: transaction.file_id,
                    sequence_num: transaction.sequence_num,
                    operations: transaction.operations,
                })
                .collect::<Vec<BinaryTransaction>>();

            tracing::trace!("got: {}", transactions.len());

            // we don't have the expected number of transactions
            // send an error to the client so they can reload
            if transactions.len() < expected_num_transactions as usize {
                return Ok(Some(MessageResponse::Error {
                    error: ResponseError::MissingTransactions(
                        expected_num_transactions.to_string(),
                        transactions.len().to_string(),
                    ),
                    error_level: ErrorLevel::Error,
                }));
            }

            let response = MessageResponse::BinaryTransactions { transactions };

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

        // User sends a ping
        MessageRequest::Ping { message } => Ok(Some(MessageResponse::Pong { message })),
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use quadratic_core::controller::operations::operation::Operation;
    use quadratic_core::controller::transaction::Transaction as CoreTransaction;
    use quadratic_core::grid::SheetId;
    use quadratic_rust_shared::net::websocket_server::pre_connection::PreConnection;
    use tokio::net::TcpStream;
    use tokio::sync::Mutex;
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
    use uuid::Uuid;

    use super::*;
    use crate::state::settings::version;
    use crate::test_util::{integration_test_receive, new_user, setup};
    use quadratic_rust_shared::multiplayer::message::{
        CellEdit, UserStateUpdate,
        request::MessageRequest,
        response::{MessageResponse, MinVersion},
    };

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

        println!("request: {:?}", &request);
        let handled = handle_message(
            request,
            state.clone(),
            stream,
            PreConnection::new(None, None),
        )
        .await
        .unwrap();
        assert_eq!(handled, response);
        println!("handled: {:?}", &handled);

        if let Some(broadcast_response) = broadcast_response {
            let received = integration_test_receive(&socket, 4).await.unwrap();
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
        let user = new_user(0);

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

        let response = MessageResponse::CurrentTransaction { sequence_num: 0 };

        let broadcast_response = MessageResponse::EnterRoom {
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
            Some(response),
            Some(broadcast_response),
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
            users: vec![user_2.clone().into()],
            version: version(),
            // TODO: to be deleted after next version
            min_version: MinVersion {
                required_version: 5,
                recommended_version: 5,
            },
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

        // old transaction version
        let compressed_ops_1 =
            CoreTransaction::serialize_and_compress_version(&operations, "1.0").unwrap();
        let encoded_ops_1 = STANDARD.encode(&compressed_ops_1);

        let request = MessageRequest::Transaction {
            id,
            file_id,
            session_id,
            operations: encoded_ops_1.clone(),
        };
        let response = MessageResponse::TransactionAck {
            id,
            file_id,
            sequence_num: 1,
        };

        // send a Transaction and expect a TransactionAck
        test_handle(
            socket.clone(),
            state.clone(),
            file_id,
            user_1.clone(),
            request,
            Some(response.clone()),
            None,
        )
        .await;

        // new transaction version
        let compressed_ops_2 = CoreTransaction::serialize_and_compress(&operations).unwrap();

        let request = MessageRequest::BinaryTransaction {
            id,
            file_id,
            session_id,
            operations: compressed_ops_2.clone(),
        };

        let response = MessageResponse::TransactionAck {
            id,
            file_id,
            sequence_num: 2,
        };

        // send a Transaction and expect a TransactionAck
        test_handle(
            socket.clone(),
            state.clone(),
            file_id,
            user_1.clone(),
            request,
            Some(response.clone()),
            None,
        )
        .await;

        // now test get_transactions
        let request = MessageRequest::GetBinaryTransactions {
            file_id,
            session_id,
            min_sequence_num: 1,
        };
        let transaction_1 = BinaryTransaction {
            id,
            file_id,
            operations: compressed_ops_1.clone(),
            sequence_num: 1,
        };
        let transaction_2 = BinaryTransaction {
            id,
            file_id,
            operations: compressed_ops_2.clone(),
            sequence_num: 2,
        };
        let response = MessageResponse::BinaryTransactions {
            transactions: vec![transaction_1, transaction_2],
        };

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
            error: ResponseError::MissingTransactions("1".into(), "0".into()), // requested 1, got 0
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
