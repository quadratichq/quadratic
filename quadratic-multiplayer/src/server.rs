//! Websocket Server
//!
//! Handle bootstrapping and starting the websocket server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    extract::{
        connect_info::ConnectInfo,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Extension, Router,
};
use axum_extra::TypedHeader;
use futures::stream::StreamExt;
use futures_util::stream::SplitSink;
use futures_util::SinkExt;
use serde::{Deserialize, Serialize};
use std::ops::ControlFlow;
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::Mutex;
use quadratic_rust_shared::auth::jwt::{authorize, get_jwks};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    background_worker,
    config::config,
    error::{ErrorLevel, MpError, Result},
    message::{
        broadcast, handle::handle_message, request::MessageRequest, response::MessageResponse,
    },
    state::{connection::PreConnection, State},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    sub: String,
    exp: usize,
}

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: Arc<State>) -> Router {
    Router::new()
        // handle websockets
        .route("/ws", get(ws_handler))
        // healthchecks
        .route("/health", get(healthcheck))
        // state
        .layer(Extension(state))
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

/// Start the websocket server.  This is the entrypoint for the application.
#[tracing::instrument(level = "trace")]
pub(crate) async fn serve() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_multiplayer=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config()?;

    // TODO(ddimaria): we do this check for every WS connection.  Does this
    // data change ofter or can it be cached?
    let jwks = get_jwks(&config.auth0_jwks_uri).await?;
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
async fn ws_handler(
    ws: WebSocketUpgrade,
    user_agent: Option<TypedHeader<headers::UserAgent>>,
    addr: Option<ConnectInfo<SocketAddr>>,
    Extension(state): Extension<Arc<State>>,
    cookie: Option<TypedHeader<headers::Cookie>>,
) -> impl IntoResponse {
    let user_agent = user_agent.map_or("Unknown user agent".into(), |user_agent| {
        user_agent.to_string()
    });
    let addr = addr.map_or("Unknown address".into(), |addr| addr.to_string());

    #[allow(unused)]
    let mut jwt = None;

    #[cfg(test)]
    {
        jwt = Some(crate::test_util::TOKEN.to_string());
    }

    if state.settings.authenticate_jwt {
        let auth_error = |error: &str| MpError::Authentication(error.to_string());

        // validate the JWT or ignore for anonymous users if it doesn't exist
        let result = async {
            let cookie = cookie.ok_or_else(|| auth_error("No cookie found"))?;
            if let Some(token) = cookie.get("jwt") {
                let jwks: jsonwebtoken::jwk::JwkSet = state
                    .settings
                    .jwks
                    .clone()
                    .ok_or_else(|| auth_error("No JWKS found"))?;

                authorize::<Claims>(&jwks, token, false, true)?;

                jwt = Some(token.to_owned());

                Ok::<_, MpError>(())
            } else {
                // this is for anonymous users
                Ok::<_, MpError>(())
            }
        }
        .await;

        if let Err(error) = result {
            tracing::warn!("Error authorizing user: {:?}", error);
            return (StatusCode::BAD_REQUEST, "Invalid token").into_response();
        }
    }

    let pre_connection = PreConnection::new(jwt);

    tracing::info!(
        "New connection {}, `{user_agent}` at {addr}",
        pre_connection.id
    );

    // upgrade the connection
    let ws = ws.max_message_size(1024 * 1024 * 1000); // 1GB
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr, pre_connection))
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
                let error_level = ErrorLevel::from(&error);
                error_level.log(&format!("Error processing message: {:?}", &error));

                if let Ok(message) = serde_json::to_string(&MessageResponse::Error {
                    error: error.to_owned(),
                    error_level,
                }) {
                    // send error message to the client
                    let sent = sender.lock().await.send(Message::Text(message)).await;

                    if let Err(sent) = sent {
                        tracing::warn!("Error sending error message: {:?}", sent);
                    }
                }

                match error {
                    // kill the ws connection for certain errors
                    MpError::Authentication(_)
                    | MpError::UserNotFound(_, _)
                    | MpError::FilePermissions(_)
                    | MpError::RoomNotFound(_) => {
                        break;
                    }
                    // noop
                    _ => {}
                };
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

                    let message = MessageResponse::from((room.users, &state.settings.min_version));

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
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    state: Arc<State>,
    pre_connection: PreConnection,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        Message::Text(text) => {
            let messsage_request = serde_json::from_str::<MessageRequest>(&text)?;
            let message_response =
                handle_message(messsage_request, state, Arc::clone(&sender), pre_connection)
                    .await?;

            if let Some(message_response) = message_response {
                let response = Message::Text(serde_json::to_string(&message_response)?);

                (*sender.lock().await)
                    .send(response)
                    .await
                    .map_err(|e| MpError::SendingMessage(e.to_string()))?;
            }
        }
        Message::Binary(d) => {
            tracing::info!(
                "Binary messages are not yet supported.  {} bytes: {:?}",
                d.len(),
                d
            );
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

pub(crate) async fn healthcheck() -> impl IntoResponse {
    StatusCode::OK
}

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::state::settings::MinVersion;
    use crate::state::user::{User, UserStateUpdate};
    use crate::test_util::{
        add_user_via_ws, integration_test_send_and_receive, new_arc_state, setup,
    };
    use axum::{
        body::Body,
        http::{self, Request},
    };
    use quadratic_core::controller::operations::operation::Operation;
    use quadratic_core::grid::SheetId;

    use tower::ServiceExt;
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

        let response = integration_test_send_and_receive(&socket, request, true, 2).await;
        assert_eq!(response, Some(expected));
    }

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

    #[tokio::test]
    async fn responds_with_a_200_ok_for_a_healthcheck() {
        let state = new_arc_state().await;
        let app = app(state);

        let response = app
            .oneshot(
                Request::builder()
                    .method(http::Method::GET)
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_user_enters_a_room() {
        // user_2 is created using the MessageRequest::EnterRoom message
        let (_, state, _, file_id, _, _) = setup().await;

        let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
        assert_eq!(num_users_in_room, 2);
    }

    #[tokio::test]
    async fn user_leaves_a_room() {
        let (socket, _, _, file_id, user_1, user_2) = setup().await;

        // user_2 leaves the room
        let request = MessageRequest::LeaveRoom {
            session_id: user_2.session_id,
            file_id,
        };

        // only the initial user is left in the room
        let expected = MessageResponse::UsersInRoom {
            users: vec![user_1.clone()],
            min_version: MinVersion::new().unwrap(),
        };

        let response = integration_test_send_and_receive(&socket, request, true, 2).await;

        assert_eq!(response, Some(expected));
    }

    #[tokio::test]
    async fn user_is_idle_in_a_room_get_removed_and_reconnect() {
        let (socket, state, _, file_id, user_1, user_2) = setup().await;

        // both users should be in the room
        let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
        assert_eq!(num_users_in_room, 2);

        // kick off the background worker and wait for the stale users to be removed
        let handle = background_worker::start(Arc::clone(&state), 1, 0);

        // expect a RoomNotFound error when trying to get the room
        loop {
            match state.get_room(&file_id).await {
                Ok(_) => {} // do nothing
                Err(error) => {
                    assert!(matches!(error, MpError::RoomNotFound(_)));
                    break;
                }
            };
        }

        // stop the background worker
        handle.abort();

        // room should be closed, add user_1 back
        add_user_via_ws(file_id, socket.clone(), user_1.clone()).await;
        integration_test_send_and_receive(
            &socket.clone(),
            new_user_state_update(user_1.clone(), file_id),
            true,
            4,
        )
        .await;

        // expect 1 user to be in the room
        let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
        assert_eq!(num_users_in_room, 1);

        // add user_2 back
        add_user_via_ws(file_id, socket.clone(), user_2.clone()).await;
        integration_test_send_and_receive(
            &socket.clone(),
            new_user_state_update(user_2.clone(), file_id),
            true,
            1,
        )
        .await;

        // expect 2 users to be in the room
        let num_users_in_room = state.get_room(&file_id).await.unwrap().users.len();
        assert_eq!(num_users_in_room, 2);
    }

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
        }];
        let id = Uuid::new_v4();
        let operations = serde_json::to_string(&operations).unwrap();
        let request = MessageRequest::Transaction {
            id,
            session_id,
            file_id,
            operations: operations.clone(),
        };
        let expected = MessageResponse::Transaction {
            id,
            file_id,
            operations,
            sequence_num: 1,
        };

        let response = integration_test_send_and_receive(&socket, request, true, 2).await;

        assert_eq!(response, Some(expected));
    }
}
