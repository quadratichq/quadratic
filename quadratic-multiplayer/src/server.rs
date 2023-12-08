//! Websocket Server
//!
//! Handle bootstrapping and starting the websocket server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use anyhow::{anyhow, Result};
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
use std::{net::SocketAddr, sync::Arc};
use std::{ops::ControlFlow, time::Duration};
use tokio::{sync::Mutex, time};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    auth::{authorize, get_jwks},
    config::{config, Config},
    message::{
        broadcast, handle::handle_message, request::MessageRequest, response::MessageResponse,
    },
    state::{Settings, State},
};

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: Arc<State>) -> Router {
    Router::new()
        // handle websockets
        .route("/ws", get(ws_handler))
        // state
        .layer(Extension(state))
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

/// Start the websocket server.  This is the entrypoint for the application.
pub(crate) async fn serve() -> Result<()> {
    let Config {
        host,
        port,
        auth0_jwks_uri,
        heartbeat_check_s,
        heartbeat_timeout_s,
        authenticate_jwt,
    } = config()?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_multiplayer=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let jwks = get_jwks(&auth0_jwks_uri).await?;
    let settings = Settings {
        jwks: Some(jwks),
        authenticate_jwt,
    };
    let state = Arc::new(State::new().with_settings(settings));
    let app = app(Arc::clone(&state));
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;

    tracing::info!("listening on {}", listener.local_addr()?);

    if !authenticate_jwt {
        tracing::warn!("JWT authentication is disabled");
    }

    check_heartbeat(Arc::clone(&state), heartbeat_check_s, heartbeat_timeout_s).await;

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

// Handle the websocket upgrade from http.
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
    let connection_id = Uuid::new_v4();

    tracing::info!("`{user_agent}` at {addr} connected: connection_id={connection_id}");

    if state.settings.authenticate_jwt {
        // validate the JWT
        let result = async {
            let cookie = cookie.ok_or_else(|| anyhow!("No cookie found"))?;
            let token = cookie.get("jwt").ok_or_else(|| anyhow!("No JWT found"))?;
            let jwks: jsonwebtoken::jwk::JwkSet = state
                .settings
                .jwks
                .clone()
                .ok_or_else(|| anyhow!("No JWKS found"))?;

            authorize(&jwks, &token, false, true)?;

            Ok::<_, anyhow::Error>(())
        }
        .await;

        if let Err(error) = result {
            tracing::warn!("Error authorizing user: {:?}", error);
            return (StatusCode::BAD_REQUEST, "Invalid token").into_response();
        }
    }

    // upgrade the connection
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr, connection_id))
}

// After websocket is established, delegate incoming messages as they arrive.
async fn handle_socket(socket: WebSocket, state: Arc<State>, addr: String, connection_id: Uuid) {
    let (sender, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sender));

    while let Some(Ok(msg)) = receiver.next().await {
        let response =
            process_message(msg, Arc::clone(&sender), Arc::clone(&state), connection_id).await;

        match response {
            Ok(ControlFlow::Continue(_)) => {}
            Ok(ControlFlow::Break(_)) => break,
            Err(e) => {
                tracing::warn!("Error processing message: {:?}", e);
            }
        }
    }

    // websocket is closed, remove the user from any rooms they were in and broadcast
    if let Ok(rooms) = state.clear_connections(connection_id).await {
        tracing::info!("Removing stale users from rooms: {:?}", rooms);

        for file_id in rooms.into_iter() {
            // only broadcast if the room still exists
            if let Ok(room) = state.get_room(&file_id).await {
                tracing::info!("Broadcasting room {file_id} after removing stale users");

                let message = MessageResponse::from(room.to_owned());
                broadcast(Uuid::new_v4(), file_id, Arc::clone(&state), message);
            }
        }
    }

    // returning from the handler closes the websocket connection
    tracing::info!("Websocket context {addr} destroyed: connection_id={connection_id}");
}

/// Based on the incoming message type, perform some action and return a response.
async fn process_message(
    msg: Message,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    state: Arc<State>,
    connection_id: Uuid,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        Message::Text(text) => {
            let messsage_request = serde_json::from_str::<MessageRequest>(&text)?;
            let message_response =
                handle_message(messsage_request, state, Arc::clone(&sender), connection_id).await?;

            if let Some(message_response) = message_response {
                let response = Message::Text(serde_json::to_string(&message_response)?);

                (*sender.lock().await).send(response).await?;
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

/// In s separate thread, check for stale users in rooms and remove them.
async fn check_heartbeat(state: Arc<State>, heartbeat_check_s: i64, heartbeat_timeout_s: i64) {
    let state = Arc::clone(&state);

    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(heartbeat_check_s as u64 * 1000));

        loop {
            let rooms = state.rooms.lock().await.clone();

            for (file_id, room) in rooms.iter() {
                match state
                    .remove_stale_users_in_room(file_id.to_owned(), heartbeat_timeout_s)
                    .await
                {
                    Ok((num_removed, num_remaining)) => {
                        tracing::info!("Checking heartbeats in room {file_id} ({num_remaining} remaining in room)");

                        if num_removed > 0 {
                            broadcast(
                                // TODO(ddimaria): use a real session_id here
                                Uuid::new_v4(),
                                file_id.to_owned(),
                                Arc::clone(&state),
                                MessageResponse::from(room.to_owned()),
                            );
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Error removing stale users from room {file_id}: {:?}", e);
                    }
                }
            }

            interval.tick().await;
        }
    });
}

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::state::user::{CellEdit, UserStateUpdate};
    use crate::test_util::{integration_test, new_user};
    use uuid::Uuid;

    #[tokio::test]
    async fn user_enters_a_room() {
        let state = Arc::new(State::new());
        let file_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let request = MessageRequest::EnterRoom {
            session_id,
            user_id: user.user_id.clone(),
            file_id,
            sheet_id: Uuid::new_v4(),
            selection: String::new(),
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
            email: user.email.clone(),
            image: user.image.clone(),
            cell_edit: CellEdit::default(),
        };
        let expected = MessageResponse::UsersInRoom { users: vec![user] };
        let response = integration_test(state, request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_leaves_a_room() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let user2 = new_user();
        let file_id = Uuid::new_v4();
        let request = MessageRequest::LeaveRoom {
            session_id,
            file_id,
        };
        let expected = MessageResponse::UsersInRoom {
            users: vec![user2.clone()],
        };

        state.enter_room(file_id, &user, connection_id).await;
        state.enter_room(file_id, &user2, connection_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_moves_a_mouse() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let file_id = Uuid::new_v4();
        let x = 0 as f64;
        let y = 0 as f64;
        let request = MessageRequest::UserUpdate {
            session_id,
            file_id,
            update: UserStateUpdate {
                x: Some(x),
                y: Some(y),
                selection: None,
                sheet_id: None,
                visible: None,
                cell_edit: None,
            },
        };
        let expected = MessageResponse::UserUpdate {
            session_id,
            file_id,
            update: UserStateUpdate {
                x: Some(x),
                y: Some(y),
                selection: None,
                sheet_id: None,
                visible: None,
                cell_edit: None,
            },
        };

        state.enter_room(file_id, &user, connection_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_changes_selection() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let file_id = Uuid::new_v4();
        let request = MessageRequest::UserUpdate {
            session_id,
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
        let expected = MessageResponse::UserUpdate {
            session_id,
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

        state.enter_room(file_id, &user, connection_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_shares_operations() {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let file_id = Uuid::new_v4();
        let request = MessageRequest::Transaction {
            session_id,
            file_id,
            operations: "test".to_string(),
        };
        let expected = MessageResponse::Transaction {
            file_id,
            operations: "test".to_string(),
        };

        state.enter_room(file_id, &user, connection_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }
}
