//! Websocket Server
//!
//! Handle bootstrapping and starting the websocket server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use anyhow::Result;
use axum::{
    extract::{
        connect_info::ConnectInfo,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
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
    config::{config, Config},
    message::{broadcast, handle_message, MessageRequest, MessageResponse},
    state::State,
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
        heartbeat_check_s,
        heartbeat_timeout_s,
    } = config()?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_multiplayer=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = Arc::new(State::new());
    let app = app(Arc::clone(&state));
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;

    tracing::info!("listening on {}", listener.local_addr()?);

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
) -> impl IntoResponse {
    let user_agent = user_agent.map_or("Unknown user agent".into(), |user_agent| {
        user_agent.to_string()
    });
    let addr = addr.map_or("Unknown address".into(), |addr| addr.to_string());
    let internal_session_id = Uuid::new_v4();

    tracing::info!("`{user_agent}` at {addr} connected: {internal_session_id}");

    // upgrade the connection
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr, internal_session_id))
}

// After websocket is established, delegate incoming messages as they arrive.
async fn handle_socket(
    socket: WebSocket,
    state: Arc<State>,
    addr: String,
    internal_session_id: Uuid,
) {
    let (sender, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sender));

    while let Some(Ok(msg)) = receiver.next().await {
        let response = process_message(
            msg,
            Arc::clone(&sender),
            Arc::clone(&state),
            internal_session_id,
        )
        .await;

        match response {
            Ok(ControlFlow::Continue(_)) => {}
            Ok(ControlFlow::Break(_)) => break,
            Err(e) => {
                tracing::error!("Error processing message: {:?}", e);
            }
        }
    }

    if let Ok(rooms) = state.clear_internal_sessions(internal_session_id).await {
        tracing::info!("Removing stale users from rooms: {:?}", rooms);

        for file_id in rooms.into_iter() {
            if let Ok(room) = state.get_room(&file_id).await {
                tracing::info!("Broadcasting room {file_id} after removing stale users");

                let message = MessageResponse::from(room.to_owned());
                broadcast(Uuid::new_v4(), file_id, Arc::clone(&state), message);
            }
        }
    }

    // returning from the handler closes the websocket connection
    tracing::info!("Websocket context {addr} destroyed: {internal_session_id}");
}

/// Based on the incoming message type, perform some action and return a response.
async fn process_message(
    msg: Message,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    state: Arc<State>,
    internal_session_id: Uuid,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        Message::Text(text) => {
            let messsage_request = serde_json::from_str::<MessageRequest>(&text)?;
            let message_response = handle_message(
                messsage_request,
                state,
                Arc::clone(&sender),
                internal_session_id,
            )
            .await?;
            let response = Message::Text(serde_json::to_string(&message_response)?);

            (*sender.lock().await).send(response).await?;
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
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(heartbeat_check_s as u64 * 1000));

        loop {
            let rooms = state.rooms.lock().await.clone();

            for (file_id, room) in rooms.iter() {
                tracing::info!("Checking heartbeats in room {file_id}");

                match state
                    .remove_stale_users_in_room(file_id.to_owned(), heartbeat_timeout_s)
                    .await
                {
                    Ok(_) => {
                        broadcast(
                            // TODO(ddimaria): use a real session_id here
                            Uuid::new_v4(),
                            file_id.to_owned(),
                            Arc::clone(&state),
                            MessageResponse::from(room.to_owned()),
                        );
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
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
            image: user.image.clone(),
        };
        let expected = MessageResponse::UsersInRoom { users: vec![user] };
        let response = integration_test(state, request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_leaves_a_room() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
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

        state.enter_room(file_id, &user, internal_session_id).await;
        state.enter_room(file_id, &user2, internal_session_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_moves_a_mouse() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let file_id = Uuid::new_v4();
        let x = 0 as f64;
        let y = 0 as f64;
        let request = MessageRequest::MouseMove {
            session_id,
            file_id,
            x: Some(x),
            y: Some(y),
        };
        let expected = MessageResponse::MouseMove {
            session_id,
            file_id,
            x: Some(x),
            y: Some(y),
        };

        state.enter_room(file_id, &user, internal_session_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_changes_selection() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let file_id = Uuid::new_v4();
        let request = MessageRequest::ChangeSelection {
            session_id,
            file_id,
            selection: "test".to_string(),
        };
        let expected = MessageResponse::ChangeSelection {
            session_id,
            file_id,
            selection: "test".to_string(),
        };

        state.enter_room(file_id, &user, internal_session_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }

    #[tokio::test]
    async fn user_shares_operations() {
        let state = Arc::new(State::new());
        let internal_session_id = Uuid::new_v4();
        let user = new_user();
        let session_id = user.session_id;
        let file_id = Uuid::new_v4();
        let request = MessageRequest::Transaction {
            session_id,
            file_id,
            operations: "test".to_string(),
        };
        let expected = MessageResponse::Transaction {
            operations: "test".to_string(),
        };

        state.enter_room(file_id, &user, internal_session_id).await;

        let response = integration_test(state.clone(), request).await;

        assert_eq!(response, serde_json::to_string(&expected).unwrap());
    }
}
