use axum::Router;
use futures::stream::StreamExt;
use futures_util::SinkExt;
use std::sync::Arc;
use std::{
    future::IntoFuture,
    net::{Ipv4Addr, SocketAddr},
};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, tungstenite};

use crate::multiplayer::message::request::MessageRequest;
use crate::multiplayer::message::response::MessageResponse;
use crate::protobuf::quadratic::transaction::{ReceiveTransaction, ReceiveTransactions};
use crate::protobuf::utils::type_name_from_peek;
use prost::Message;
// use tower::ServiceExt;

/// Setup integration testing, which:
/// - Runs the app in a separate thread
/// - Connects to the app via WebSocket
/// - Returns a reference to the user's `receiver` WebSocket
pub async fn integration_test_setup(app: Router) -> WebSocketStream<MaybeTlsStream<TcpStream>> {
    let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, 0)))
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();

    // run the server in a separate thread
    tokio::spawn(
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .into_future(),
    );

    let (socket, _response) = tokio_tungstenite::connect_async(format!("ws://{addr}/ws"))
        .await
        .unwrap();

    socket
}

/// Using the WebSocket created in integration_test_setup(), send a message
/// and receive a response.
/// `response_num` is the number of responses to receive before returning the last one.
/// Returns the optional response.
pub async fn integration_test_send_and_receive(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    request: MessageRequest,
    expect_response: bool,
    response_num: usize,
) -> Option<MessageResponse> {
    // send the message
    integration_test_send(socket, request).await;

    if !expect_response {
        return None;
    }

    integration_test_receive(socket, response_num).await
}

/// Using the WebSocket created in integration_test_setup(), send a message.
pub async fn integration_test_send(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    request: MessageRequest,
) {
    // send the message
    if let Err(e) = socket
        .lock()
        .await
        .send(tungstenite::Message::text(
            serde_json::to_string(&request).unwrap(),
        ))
        .await
    {
        println!("Error sending message: {e:?}");
    };
}

/// Using the WebSocket created in integration_test_setup(), receive a response.
/// Returns the optional response.
/// `response_num` is the number of responses to receive before returning the last one.
pub async fn integration_test_receive(
    socket: &Arc<Mutex<WebSocketStream<MaybeTlsStream<TcpStream>>>>,
    response_num: usize,
) -> Option<MessageResponse> {
    let mut last_response = None;
    let mut count = 0;

    while let Some(Ok(msg)) = socket.lock().await.next().await {
        count += 1;
        last_response = match msg {
            tungstenite::Message::Text(msg) => {
                Some(serde_json::from_str::<MessageResponse>(&msg).unwrap())
            }
            tungstenite::Message::Binary(binary) => {
                if let Ok(type_name) = type_name_from_peek(&binary) {
                    match type_name.as_str() {
                        "BinaryTransactions" => {
                            match ReceiveTransactions::decode(binary) {
                                Ok(decoded) => {
                                    println!("BinaryTransactions: {decoded:?}");
                                }
                                Err(e) => println!("Error decoding BinaryTransactions: {e:?}"),
                            };
                        }
                        "BinaryTransaction" => {
                            match ReceiveTransaction::decode(binary) {
                                Ok(decoded) => {
                                    println!("BinaryTransaction: {decoded:?}");
                                }
                                Err(e) => println!("Error decoding BinaryTransaction: {e:?}"),
                            };
                        }
                        // we don't care about other messages
                        _ => {}
                    }
                }
                None
            }
            other => panic!("expected a text message but got {other:?}"),
        };

        if count >= response_num {
            break;
        }
    }

    last_response
}
