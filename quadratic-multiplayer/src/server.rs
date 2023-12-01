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

/// Construct the application router.  This is separated out so that it can be
/// integration tested.
pub(crate) fn app() -> Router {
    Router::new()
        // handle websockets
        .route("/ws", get(ws_handler))
        // state
        .layer(Extension(Arc::new(State::new())))
        // logger
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::default().include_headers(true)),
        )
}

/// Start the websocket server.  This is the entrypoint for the application.
pub(crate) async fn serve() -> Result<()> {
    let Config { host, port } = config()?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quadratic_multiplayer=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = app();
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;

    tracing::info!("listening on {}", listener.local_addr()?);

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

    tracing::info!("`{user_agent}` at {addr} connected.");

    // upgrade the connection
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr))
}

// After websocket is established, delegate incoming messages as they arrive.
async fn handle_socket(socket: WebSocket, state: Arc<State>, addr: String) {
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

/// Based on the incoming message type, perform some action and return a response.
async fn process_message(
    msg: Message,
    sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    state: Arc<State>,
) -> Result<ControlFlow<Option<MessageResponse>, ()>> {
    match msg {
        Message::Text(text) => {
            let messsage_request = serde_json::from_str::<MessageRequest>(&text)?;
            let message_response =
                handle_message(messsage_request, state, Arc::clone(&sender)).await?;
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

#[cfg(test)]
pub(crate) mod tests {

    use super::*;
    use std::{
        future::IntoFuture,
        net::{Ipv4Addr, SocketAddr},
    };
    use tokio_tungstenite::tungstenite;
    use uuid::Uuid;

    pub(crate) async fn integration_test(request: MessageRequest) -> String {
        let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, 0)))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(axum::serve(listener, app()).into_future());

        let (mut socket, _response) = tokio_tungstenite::connect_async(format!("ws://{addr}/ws"))
            .await
            .unwrap();

        // send the message
        socket
            .send(tungstenite::Message::text(
                serde_json::to_string(&request).unwrap(),
            ))
            .await
            .unwrap();

        match socket.next().await.unwrap().unwrap() {
            tungstenite::Message::Text(msg) => msg,
            other => panic!("expected a text message but got {other:?}"),
        }
    }

    #[tokio::test]
    async fn user_enters_a_room() {
        let user_id = Uuid::new_v4();
        let file_id = Uuid::new_v4();
        let first_name = "a".to_string();
        let last_name = "b".to_string();
        let image = "c".to_string();

        let request = MessageRequest::EnterRoom {
            user_id,
            file_id,
            first_name: first_name.clone(),
            last_name: last_name.clone(),
            image: image.clone(),
        };
        let expected_response = format!(
            r#"{{"type":"Room","room":{{"file_id":"{file_id}","users":{{"{user_id}":{{"first_name":"{first_name}","last_name":"{last_name}","image":"{image}"}}}}}}}}"#
        );

        let response = integration_test(request).await;

        assert_eq!(response, expected_response);
    }

    // #[tokio::test]
    // async fn user_moves_a_mouse() {
    //     let user_id = Uuid::new_v4();
    //     let file_id = Uuid::new_v4();
    //     let x = 0 as f64;
    //     let y = 0 as f64;

    //     let request = MessageRequest::MouseMove {
    //         user_id,
    //         file_id,
    //         x,
    //         y,
    //     };

    //     let expected_response =
    //         format!(r#"{{"type":"MouseMove", "file_id":"{file_id}","user_id":"{user_id}"}}"#);

    //     let response = integration_test(request).await;

    //     assert_eq!(response, expected_response);
    // }
}
