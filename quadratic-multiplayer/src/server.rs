//! Websocket Server
//!

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
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;

use std::ops::ControlFlow;
use std::{net::SocketAddr, sync::Arc};
use tower_http::trace::{DefaultMakeSpan, TraceLayer};

use futures::stream::StreamExt;
use futures_util::SinkExt;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::{config, Config},
    message::{handle_message, MessageRequest, MessageResponse},
    state::State,
};

pub async fn serve() -> Result<()> {
    let Config { host, port } = config()?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_multiplayer=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = Router::new()
        // handle websockets
        .route("/ws", get(ws_handler))
        // state
        .layer(Extension(Arc::new(State::new())))
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        );

    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;

    tracing::info!("listening on {}", listener.local_addr()?);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

// handle the websocket upgrade from http
async fn ws_handler(
    ws: WebSocketUpgrade,
    user_agent: Option<TypedHeader<headers::UserAgent>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Extension(state): Extension<Arc<State>>,
) -> impl IntoResponse {
    let user_agent = user_agent.map_or("Unknown user agent".into(), |user_agent| {
        user_agent.to_string()
    });

    tracing::info!("`{user_agent}` at {addr} connected.");

    // upgrade the connection
    ws.on_upgrade(move |socket| handle_socket(socket, addr, state))
}

// after websocket is established, handle incoming messages
async fn handle_socket(socket: WebSocket, addr: SocketAddr, state: Arc<State>) {
    let (sender, mut receiver) = socket.split();
    let sender = Arc::new(Mutex::new(sender));

    while let Some(Ok(msg)) = receiver.next().await {
        let response = process_message(msg, Arc::clone(&sender), Arc::clone(&state)).await;

        match response {
            Ok(ControlFlow::Continue(_)) => {}
            Ok(ControlFlow::Break(_)) => break,
            Err(e) => {
                tracing::error!("Error processing message: {:?}", e);
            }
        }
    }

    // returning from the handler closes the websocket connection
    tracing::info!("Websocket context {addr} destroyed");
}

async fn process_message(
    msg: Message,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    state: Arc<State>,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        Message::Text(text) => {
            let messsage_request = serde_json::from_str::<MessageRequest>(&text)?;
            let message_response = handle_message(messsage_request, state).await?;
            let response = Message::Text(serde_json::to_string(&message_response)?);

            (*sender.lock().await).send(response).await?;
        }
        Message::Binary(d) => {
            tracing::info!("{} bytes: {:?}", d.len(), d);
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
