//! HTTP Server
//!
//! Handle bootstrapping and starting the HTTP server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::Json;
use axum::http::Method;
use axum::response::IntoResponse;
use axum::{Extension, Router, routing::get};
use axum::{
    extract::{
        connect_info::ConnectInfo,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::{HeaderMap, StatusCode},
};
use axum_extra::TypedHeader;
use futures::stream::StreamExt;
use futures_util::SinkExt;
use prost::Message as ProstMessage;
use quadratic_rust_shared::auth::jwt::get_jwks;
use quadratic_rust_shared::auth::jwt::tests::TOKEN;
use quadratic_rust_shared::net::websocket_server::server::SharedSplitSinkSocket;
use quadratic_rust_shared::protobuf::quadratic::transaction::Error;
use quadratic_rust_shared::storage::Storage;
use quadratic_rust_shared::{
    ErrorLevel,
    net::websocket_server::{pre_connection::PreConnection, server::WebsocketServer},
};
use std::ops::ControlFlow;
use std::time::Duration;
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::Mutex;
use tokio::time;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::health::{full_healthcheck, healthcheck};
use crate::message::handle::handle_message;
use crate::message::request::MessageRequest;
use crate::message::response::MessageResponse;
use crate::scheduled_tasks::get_scheduled_tasks;
use crate::state::stats::StatsResponse;
use crate::{
    auth::get_middleware,
    config::config,
    error::{CoreCloudError, Result},
    scheduled_tasks::process,
    state::State,
};

const STATS_INTERVAL_S: u64 = 30;

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app(state: Arc<State>) -> Router {
    // get the auth middleware
    let jwks = state
        .settings
        .jwks
        .as_ref()
        .expect("JWKS not found in state")
        .to_owned();
    let auth = get_middleware(jwks);
    let path = state.settings.storage.path().to_owned();

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any)
        .allow_headers(Any)
        .expose_headers(Any);

    tracing::info!("Serving files from {path}");

    Router::new()
        // protected routes
        // handle websockets
        .route("/ws", get(ws_handler))
        //
        // auth middleware
        .route_layer(auth)
        //
        // UNPROTECTED ROUTES
        //
        // healthcheck
        .route("/health", get(healthcheck))
        //
        // full healthcheck
        .route("/health/full", get(full_healthcheck))
        //
        // stats
        .route("/stats", get(stats))
        //
        // state
        .layer(Extension(state))
        //
        // cors
        .layer(cors)
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
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_core_cloud=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config()?;
    let jwks = get_jwks(&config.auth0_jwks_uri).await?;
    let state = Arc::new(State::new(&config, Some(jwks)).await?);
    let app = app(Arc::clone(&state));
    let scheduled_tasks = config.pubsub_scheduled_tasks.to_owned();

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port))
        .await
        .map_err(|e| CoreCloudError::InternalServer(e.to_string()))?;

    let local_addr = listener
        .local_addr()
        .map_err(|e| CoreCloudError::InternalServer(e.to_string()))?;

    tracing::info!(
        "listening on {local_addr}, environment={}",
        config.environment
    );

    // in a separate thread, process all scheduled tasks in the queue
    tokio::spawn({
        let state = Arc::clone(&state);

        async move {
            let mut interval = time::interval(Duration::from_secs(config.pubsub_check_s as u64));

            loop {
                interval.tick().await;

                if let Err(error) = process(&state, &config.pubsub_scheduled_tasks).await {
                    tracing::error!("Error processing scheduled tasks: {error}");
                }
            }
        }
    });

    // in a separate thread, log stats
    tokio::spawn({
        let state = Arc::clone(&state);

        async move {
            let mut interval = time::interval(Duration::from_secs(STATS_INTERVAL_S));

            loop {
                interval.tick().await;

                // reconnect to pubsub if the connection becomes unhealthy
                state.pubsub.lock().await.reconnect_if_unhealthy().await;

                if let Ok(files) = get_scheduled_tasks(&state, &scheduled_tasks).await {
                    state.stats.lock().await.files_to_process_in_pubsub = files.len() as u64;
                }

                let stats = state.stats.lock().await;

                // push stats to the logs if there are files to process
                if stats.files_to_process_in_pubsub > 0 {
                    tracing::info!(
                        r#"{{ "files_to_process_in_pubsub": "{:#?}", "last_processed_file_time": "{:#?}" }}"#,
                        stats.files_to_process_in_pubsub,
                        stats.last_processed_file_time.unwrap_or_default(),
                    );
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
        CoreCloudError::InternalServer(e.to_string())
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
    let pre_connection = WebsocketServer::authenticate(
        user_agent,
        addr,
        cookie,
        headers,
        true,
        state.settings.jwks.clone(),
        cfg!(test).then(|| TOKEN.to_string()),
    );

    match pre_connection {
        Ok(pre_connection) => {
            // upgrade the connection
            let ws = ws.max_message_size(1024 * 1024 * 1000); // 1GB
            ws.on_upgrade(move |socket| {
                handle_socket(socket, state, addr.to_string(), pre_connection)
            })
        }
        Err(error) => {
            tracing::warn!("Error authorizing user: {:?}", error);
            return (StatusCode::BAD_REQUEST, "Invalid token").into_response();
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
                let error_level = ErrorLevel::from(&error);
                error_level.log(&format!("Error processing message: {:?}", &error));

                let error_message = Error {
                    r#type: "Error".to_string(),
                    error: error.to_string(),
                    error_level: error_level.to_string(),
                };
                let encoded = ProstMessage::encode_to_vec(&error_message);
                // send error message to the client
                let sent = sender
                    .lock()
                    .await
                    .send(Message::Binary(encoded.into()))
                    .await;

                if let Err(sent) = sent {
                    tracing::warn!("Error sending error message: {:?}", sent);
                }

                match error {
                    // kill the ws connection for certain errors
                    CoreCloudError::Authentication(_) => {
                        break;
                    }
                    // noop
                    _ => {}
                };
            }
        }
    }

    // websocket is closed, remove the user from any rooms they were in and broadcast
    // if let Ok(connection) = state.get_connection(connection_id).await {
    //     match state.remove_connection(&connection).await {
    //         Ok(Some(file_id)) => {
    //             tracing::info!(
    //                 "Removing user {} from room {file_id} after connection close",
    //                 connection.session_id
    //             );

    //             if let Ok(room) = state.get_room(&file_id).await {
    //                 tracing::info!("Broadcasting room {file_id} after connection close");

    //                 let message = MessageResponse::from((room.users, &state.settings.version));
    //                 if let Err(error) = broadcast(
    //                     vec![connection.session_id],
    //                     file_id,
    //                     Arc::clone(&state),
    //                     message,
    //                 )
    //                 .await
    //                 {
    //                     tracing::warn!(
    //                         "Error broadcasting room {file_id} after connection close: {:?}",
    //                         error
    //                     );
    //                 }
    //             }
    //         }
    //         Err(error) => {
    //             tracing::warn!("Error clearing connections: {:?}", error);
    //         }
    //         _ => {}
    //     }
    // }

    // returning from the handler closes the websocket connection
    tracing::info!("Websocket context {addr} destroyed: connection_id={connection_id}");
}

/// Based on the incoming message type, perform some action and return a response.
#[tracing::instrument(level = "trace")]
async fn process_message(
    msg: Message,
    sender: SharedSplitSinkSocket,
    state: Arc<State>,
    pre_connection: PreConnection,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        // binary messages are protocol buffers
        Message::Binary(b) => {
            // TODO(ddimaria): use pre-connection and state
            // let message_response =
            //     handle_message(&b, state, Arc::clone(&sender), pre_connection).await?;
            let decoded = MessageRequest::decode(&b)?;
            let message_response = handle_message(decoded, state, pre_connection).await?;

            send_response(sender, message_response).await?;
        }
        Message::Text(_text) => tracing::info!("Text message type not supported"),
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
    sender: SharedSplitSinkSocket,
    message: Option<MessageResponse>,
) -> Result<()> {
    if let Some(message) = message {
        let encoded = message.encode()?;
        WebsocketServer::send_binary(sender, encoded.into()).await?;
    }

    Ok(())
}

pub(crate) async fn stats(state: Extension<Arc<State>>) -> impl IntoResponse {
    let stats = state.stats.lock().await.to_owned();
    let response = StatsResponse::from(&stats);

    Json(response)
}

#[cfg(test)]
pub(crate) mod tests {
    use crate::test_util::{new_arc_state, response};
    use axum::http::{Method, StatusCode};

    use super::*;

    #[tokio::test]
    async fn responds_with_a_200_ok_for_stats() {
        let state = new_arc_state().await;
        let app = app(state);
        let response = response(app, Method::GET, "/stats").await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
