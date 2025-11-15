//! Websocket Server
//!
//! Handle bootstrapping and starting the websocket server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    Extension, Router,
    extract::{
        connect_info::ConnectInfo,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
};
use axum_extra::TypedHeader;
use futures::stream::StreamExt;
use futures_util::SinkExt;
use quadratic_rust_shared::{
    ErrorLevel,
    auth::jwt::{get_jwks, tests::TOKEN},
    multiplayer::message::{
        request::MessageRequest,
        response::{MessageResponse, ResponseError},
    },
    net::websocket_server::{pre_connection::PreConnection, server::WebsocketServer},
};
use std::{net::SocketAddr, sync::Arc};
use std::{ops::ControlFlow, time::Duration};
use tokio::{sync::Mutex, time};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    background_worker,
    config::config,
    error::{MpError, Result},
    health::{full_healthcheck, healthcheck},
    message::{
        broadcast,
        handle::handle_message,
        proto::{request::decode_transaction, response::encode_message},
    },
    state::{State, user::UserSocket},
};

const STATS_INTERVAL_S: u64 = 60;

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: Arc<State>) -> Router {
    Router::new()
        //
        // handle websockets
        .route("/ws", get(ws_handler))
        //
        // healthcheck
        .route("/health", get(healthcheck))
        //
        // full healthcheck
        .route("/health/full", get(full_healthcheck))
        //
        // state
        .layer(Extension(state))
        //
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

/// Start the websocket server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    let tracing_layer = if config()?.environment.is_production() {
        tracing_subscriber::fmt::layer().json().boxed()
    } else {
        tracing_subscriber::fmt::layer().boxed()
    };

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_multiplayer=debug,tower_http=debug".into()),
        )
        .with(tracing_layer)
        .init();

    let config = config()?;

    // TODO(ddimaria): we do this check for every WS connection.  Does this
    // data change ofter or can it be cached?
    let jwks = get_jwks(&config.jwks_uri).await?;
    let state = Arc::new(State::new(&config, Some(jwks)).await?);
    let app = app(Arc::clone(&state));

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port))
        .await
        .map_err(|e| MpError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| MpError::InternalServer(e.to_string()))?;

    tracing::info!(
        "listening on {local_addr}, environment={}",
        config.environment
    );

    if !config.authenticate_jwt {
        tracing::warn!("JWT authentication is disabled");
    }

    // perform various activities in a separate thread
    background_worker::start(
        Arc::clone(&state),
        config.heartbeat_check_s,
        config.heartbeat_timeout_s,
    );

    // in a separate thread, log stats
    tokio::spawn({
        let state = Arc::clone(&state);

        async move {
            let mut interval = time::interval(Duration::from_secs(STATS_INTERVAL_S));

            loop {
                interval.tick().await;
                let stats = state.stats().await;

                if let Ok(json) = serde_json::to_string(&stats) {
                    tracing::info!("{json}");
                }
            }
        }
    });

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .map_err(|e| {
        tracing::warn!("{e}");
        MpError::InternalServer(e.to_string())
    })?;

    Ok(())
}

// Handle the websocket upgrade from http.
#[tracing::instrument(level = "trace")]
#[axum_macros::debug_handler]
async fn ws_handler(
    ws: WebSocketUpgrade,
    user_agent: Option<TypedHeader<headers::UserAgent>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Extension(state): Extension<Arc<State>>,
    cookie: Option<TypedHeader<headers::Cookie>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_agent_str = user_agent
        .as_ref()
        .map(|ua| ua.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let pre_connection = WebsocketServer::authenticate(
        user_agent,
        addr,
        cookie,
        headers,
        state.settings.authenticate_jwt,
        state.settings.jwks.clone(),
        cfg!(test).then(|| TOKEN.to_string()),
    );

    match pre_connection {
        Ok(pre_connection) => {
            tracing::info!(
                "New connection {}, `{}` at {addr}",
                pre_connection.id,
                user_agent_str
            );

            // upgrade the connection
            let ws = ws.max_message_size(1024 * 1024 * 1000); // 1GB
            ws.on_upgrade(move |socket| {
                handle_socket(socket, state, addr.to_string(), pre_connection)
            })
        }
        Err(error) => {
            tracing::warn!("Error authorizing user: {:?}", error);
            (StatusCode::BAD_REQUEST, "Invalid token").into_response()
        }
    }
}

// After websocket is established, delegate incoming messages as they arrive.
#[tracing::instrument(level = "trace")]
async fn handle_socket(
    socket: WebSocket,
    state: Arc<State>,
    addr: String,
    pre_connection: PreConnection,
) {
    let (sender, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sender));
    let connection_id = pre_connection.id;

    while let Some(Ok(msg)) = receiver.next().await {
        let response = process_message(
            msg,
            Arc::clone(&sender),
            Arc::clone(&state),
            pre_connection.to_owned(),
        )
        .await;

        match response {
            Ok(ControlFlow::Continue(_)) => {}
            Ok(ControlFlow::Break(_)) => break,
            Err(error) => {
                let should_break = matches!(
                    error,
                    MpError::Authentication(_)
                        | MpError::UserNotFound(_, _)
                        | MpError::FilePermissions(_)
                        | MpError::RoomNotFound(_)
                );

                let error_level = ErrorLevel::from(&error);
                error_level.log(&format!("Error processing message: {:?}", &error));

                let response_error = match error {
                    MpError::MissingTransactions(expected, got) => {
                        ResponseError::MissingTransactions(expected, got)
                    }
                    _ => ResponseError::Unknown(error.to_string()),
                };

                if let Ok(message) = serde_json::to_string(&MessageResponse::Error {
                    error: response_error,
                    error_level,
                }) {
                    // send error message to the client
                    let sent = sender
                        .lock()
                        .await
                        .send(Message::Text(message.into()))
                        .await;

                    if let Err(sent) = sent {
                        tracing::warn!("Error sending error message: {:?}", sent);
                    }
                }

                if should_break {
                    break;
                }
            }
        }
    }

    // websocket is closed, remove the user from any rooms they were in and broadcast
    if let Ok(connection) = state.get_connection(connection_id).await {
        match state.remove_connection(&connection).await {
            Ok(Some(file_id)) => {
                tracing::info!(
                    "Removing user {} from room {file_id} after connection close",
                    connection.session_id
                );

                if let Ok(room) = state.get_room(&file_id).await {
                    tracing::info!("Broadcasting room {file_id} after connection close");

                    let message = room.to_users_in_room_response(&state.settings.version);
                    if let Err(error) = broadcast(
                        vec![connection.session_id],
                        file_id,
                        Arc::clone(&state),
                        message,
                    )
                    .await
                    {
                        tracing::warn!(
                            "Error broadcasting room {file_id} after connection close: {:?}",
                            error
                        );
                    }
                }
            }
            Err(error) => {
                tracing::warn!("Error clearing connections: {:?}", error);
            }
            _ => {}
        }
    }

    // returning from the handler closes the websocket connection
    tracing::info!("Websocket context {addr} destroyed: connection_id={connection_id}");
}

/// Based on the incoming message type, perform some action and return a response.
#[tracing::instrument(level = "trace")]
async fn process_message(
    msg: Message,
    sender: UserSocket,
    state: Arc<State>,
    pre_connection: PreConnection,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        Message::Text(text) => {
            let message_request = serde_json::from_str::<MessageRequest>(&text)?;
            let message_response =
                handle_message(message_request, state, Arc::clone(&sender), pre_connection).await?;

            send_response(sender, message_response).await?;
        }
        // binary messages are protocol buffers
        Message::Binary(b) => {
            let transaction = decode_transaction(&b)?;
            let message_request = MessageRequest::BinaryTransaction {
                id: transaction.id.parse()?,
                session_id: transaction.session_id.parse()?,
                file_id: transaction.file_id.parse()?,
                operations: transaction.operations,
            };
            let message_response =
                handle_message(message_request, state, Arc::clone(&sender), pre_connection).await?;

            send_response(sender, message_response).await?;
        }
        Message::Close(c) => {
            if let Some(cf) = c {
                tracing::info!("Close with code {} and reason `{}`", cf.code, cf.reason);
            } else {
                tracing::info!("Somehow sent close message without CloseFrame");
            }
            return Ok(ControlFlow::Break(None));
        }
        _ => {
            tracing::info!("Unhandled message type");
        }
    }

    Ok(ControlFlow::Continue(()))
}

pub(crate) async fn send_response(
    sender: UserSocket,
    message: Option<MessageResponse>,
) -> Result<()> {
    if let Some(message) = message {
        return match message.is_binary() {
            true => WebsocketServer::send_binary(sender, encode_message(message)?.into())
                .await
                .map_err(MpError::from),
            false => WebsocketServer::send_text(sender, message)
                .await
                .map_err(MpError::from),
        };
    }

    Ok(())
}

#[cfg(test)]
pub(crate) mod tests {

    use crate::state::user::User;
    use crate::test_util::{integration_test_send_and_receive, setup};
    use quadratic_rust_shared::multiplayer::message::UserStateUpdate;
    use quadratic_rust_shared::multiplayer::message::request::MessageRequest;
    use quadratic_rust_shared::multiplayer::message::response::MessageResponse;

    use base64::{Engine, engine::general_purpose::STANDARD};
    use quadratic_core::controller::operations::operation::Operation;
    use quadratic_core::controller::transaction::Transaction;
    use quadratic_core::grid::SheetId;
    use uuid::Uuid;

    async fn assert_user_changes_state(update: UserStateUpdate) {
        let (socket, _, _, file_id, user, _) = setup().await;
        let session_id = user.session_id;
        let request = MessageRequest::UserUpdate {
            session_id,
            file_id,
            update: update.clone(),
        };
        let expected = MessageResponse::UserUpdate {
            session_id,
            file_id,
            update,
        };

        let response = integration_test_send_and_receive(&socket, request, true, 4).await;
        assert_eq!(response, Some(expected));
    }

    #[allow(dead_code)]
    fn new_user_state_update(user: User, file_id: Uuid) -> MessageRequest {
        MessageRequest::UserUpdate {
            session_id: user.session_id,
            file_id,
            update: UserStateUpdate {
                selection: None,
                sheet_id: None,
                x: None,
                y: None,
                visible: None,
                cell_edit: None,
                code_running: None,
                viewport: Some("new_viewport".to_string()),
                follow: None,
            },
        }
    }

    // flaky test which often gets stuck until timeout
    //
    // #[tokio::test]
    // async fn user_is_idle_in_a_room_get_removed_and_reconnect() {
    //     let (socket, state, _, file_id, user_1, user_2) = setup().await;

    //     // both users should be in the room
    //     let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
    //     assert_eq!(num_users_in_room, 2);

    //     // kick off the background worker and wait for the stale users to be removed
    //     let handle = background_worker::start(Arc::clone(&state), 1, 0);

    //     // wait on the background worker to finish, then abort it
    //     sleep(Duration::from_secs(2)).await;
    //     handle.abort();

    //     let now = Instant::now();
    //     let mut timed_out = false;

    //     loop {
    //         // expect a RoomNotFound error when trying to get the room
    //         match state.get_room(&file_id).await {
    //             Ok(_) => {} // do nothing
    //             Err(error) => {
    //                 assert!(matches!(error, MpError::RoomNotFound(_)));
    //                 break;
    //             }
    //         };

    //         // failsafe to avoid timeouts in CI
    //         if now.elapsed().as_secs() > 3 {
    //             timed_out = true;
    //             break;
    //         }
    //     }

    //     // room should be closed, add user_1 back
    //     add_user_via_ws(file_id, socket.clone(), user_1.clone()).await;
    //     integration_test_send_and_receive(
    //         &socket.clone(),
    //         new_user_state_update(user_1.clone(), file_id),
    //         true,
    //         4,
    //     )
    //     .await;

    //     if !timed_out {
    //         // expect 1 user to be in the room
    //         let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
    //         assert_eq!(num_users_in_room, 1);

    //         // add user_2 back
    //         add_user_via_ws(file_id, socket.clone(), user_2.clone()).await;
    //         integration_test_send_and_receive(
    //             &socket.clone(),
    //             new_user_state_update(user_2.clone(), file_id),
    //             true,
    //             1,
    //         )
    //         .await;

    //         // expect 2 users to be in the room
    //         let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
    //         assert_eq!(num_users_in_room, 2);
    //     }
    // }

    #[tokio::test]
    async fn user_moves_a_mouse() {
        let update = UserStateUpdate {
            x: Some(1.0),
            y: Some(2.0),
            ..Default::default()
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_changes_selection() {
        let update = UserStateUpdate {
            selection: Some("test".to_string()),
            ..Default::default()
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_changes_viewport() {
        let update = UserStateUpdate {
            viewport: Some("new_viewport".to_string()),
            ..Default::default()
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_changes_running() {
        let update = UserStateUpdate {
            code_running: Some("new_running".to_string()),
            ..Default::default()
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_shares_operations() {
        let (socket, _, _, file_id, user, _) = setup().await;
        let session_id = user.session_id;
        let operations = vec![Operation::SetSheetName {
            sheet_id: SheetId::new(),
            name: "test".to_string(),
            old_sheet_name: None,
        }];
        let id = Uuid::new_v4();
        let compressed_ops = Transaction::serialize_and_compress(&operations).unwrap();
        let encoded_ops = STANDARD.encode(&compressed_ops);
        let request = MessageRequest::Transaction {
            id,
            session_id,
            file_id,
            operations: encoded_ops.clone(),
        };
        let expected = MessageResponse::TransactionAck {
            id,
            file_id,
            sequence_num: 1,
        };

        let response = integration_test_send_and_receive(&socket, request, true, 4).await;

        assert_eq!(response, Some(expected));
    }
}
