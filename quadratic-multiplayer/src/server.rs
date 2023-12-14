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
use std::ops::ControlFlow;
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::Mutex;
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use crate::{
    auth::{authorize, get_jwks},
    background_worker,
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
#[tracing::instrument]
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

    background_worker::work(Arc::clone(&state), heartbeat_check_s, heartbeat_timeout_s).await;

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

// Handle the websocket upgrade from http.
#[tracing::instrument]
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

            authorize(&jwks, token, false, true)?;

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
#[tracing::instrument]
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
#[tracing::instrument]
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

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use crate::state::user::{CellEdit, User, UserStateUpdate};
    use crate::test_util::{integration_test_send_and_receive, integration_test_setup, new_user};
    use quadratic_core::controller::operation::Operation;
    use tokio::net::TcpStream;
    use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
    use uuid::Uuid;

    async fn add_user_via_ws(
        file_id: Uuid,
        socket: Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    ) -> User {
        let user = new_user();
        let session_id = user.session_id;
        let request = MessageRequest::EnterRoom {
            session_id,
            user_id: user.user_id.clone(),
            file_id,
            sheet_id: user.state.sheet_id,
            selection: String::new(),
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
            email: user.email.clone(),
            image: user.image.clone(),
            cell_edit: CellEdit::default(),
            viewport: "initial viewport".to_string(),
        };

        integration_test_send_and_receive(socket, request, true).await;

        user
    }

    async fn setup() -> (
        Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
        Arc<State>,
        Uuid,
        Uuid,
        User,
    ) {
        let state = Arc::new(State::new());
        let connection_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let socket = integration_test_setup(state.clone()).await;
        let socket = Arc::new(Mutex::new(socket));
        let user = add_user_via_ws(file_id, socket.clone()).await;

        (socket.clone(), state, connection_id, file_id, user)
    }

    async fn assert_user_changes_state(update: UserStateUpdate) {
        let (socket, _, _, file_id, _) = setup().await;
        let new_user = new_user();
        let session_id = new_user.session_id;
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

        let response = integration_test_send_and_receive(socket, request, true).await;

        assert_eq!(response, Some(serde_json::to_string(&expected).unwrap()));
    }

    #[tokio::test]
    async fn user_enters_a_room() {
        let (socket, _, _, file_id, user) = setup().await;
        let new_user = new_user();
        let session_id = new_user.session_id;
        let request = MessageRequest::EnterRoom {
            session_id,
            user_id: new_user.user_id.clone(),
            file_id,
            sheet_id: new_user.state.sheet_id,
            selection: String::new(),
            first_name: new_user.first_name.clone(),
            last_name: new_user.last_name.clone(),
            email: new_user.email.clone(),
            image: new_user.image.clone(),
            cell_edit: CellEdit::default(),
            viewport: "initial viewport".to_string(),
        };
        let expected_1 = MessageResponse::UsersInRoom {
            users: vec![new_user.clone(), user.clone()],
        };
        let expected_2 = MessageResponse::UsersInRoom {
            users: vec![user, new_user],
        };
        let response = integration_test_send_and_receive(socket, request, true).await;

        // order is brittle, this feels hacky
        assert!(
            response == Some(serde_json::to_string(&expected_1).unwrap())
                || response == Some(serde_json::to_string(&expected_2).unwrap())
        );
    }

    #[tokio::test]
    async fn user_leaves_a_room() {
        let (socket, state, connection_id, file_id, user) = setup().await;
        let new_user = new_user();
        let session_id = new_user.session_id;
        let request = MessageRequest::LeaveRoom {
            session_id,
            file_id,
        };
        let expected = MessageResponse::UsersInRoom {
            users: vec![user.clone()],
        };

        state.enter_room(file_id, &new_user, connection_id).await;

        let response = integration_test_send_and_receive(socket, request, true).await;

        assert_eq!(response, Some(serde_json::to_string(&expected).unwrap()));
    }

    #[tokio::test]
    async fn user_moves_a_mouse() {
        let update = UserStateUpdate {
            x: Some(1.0),
            y: Some(2.0),
            selection: None,
            sheet_id: None,
            visible: None,
            cell_edit: None,
            viewport: None,
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_changes_selection() {
        let update = UserStateUpdate {
            selection: Some("test".to_string()),
            sheet_id: None,
            x: None,
            y: None,
            visible: None,
            cell_edit: None,
            viewport: None,
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_changes_viewport() {
        let update = UserStateUpdate {
            selection: None,
            sheet_id: None,
            x: None,
            y: None,
            visible: None,
            cell_edit: None,
            viewport: Some("new_viewport".to_string()),
        };

        assert_user_changes_state(update).await;
    }

    #[tokio::test]
    async fn user_shares_operations() {
        let (socket, _, _, file_id, _) = setup().await;
        let new_user = new_user();
        let session_id = new_user.session_id;
        let operations = serde_json::to_string::<Vec<Operation>>(&vec![]).unwrap();
        let id = Uuid::new_v4();
        let request = MessageRequest::Transaction {
            id,
            session_id,
            file_id,
            operations: operations.clone(),
        };
        let expected = MessageResponse::Transaction {
            id,
            file_id,
            operations: operations.clone(),
            sequence_num: 1,
        };

        let response = integration_test_send_and_receive(socket, request, true).await;

        assert_eq!(response, Some(serde_json::to_string(&expected).unwrap()));
    }
}
