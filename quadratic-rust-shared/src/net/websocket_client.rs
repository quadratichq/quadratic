use std::str::FromStr;

use futures_util::{
    SinkExt, StreamExt,
    stream::{SplitSink, SplitStream},
};
use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
pub use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{
        client::IntoClientRequest,
        http::{HeaderName, Response},
    },
};
use uuid::Uuid;

use crate::net::error::Net;
use crate::{SharedError, multiplayer::message::request::MessageRequest};
use crate::{error::Result, multiplayer::message::CellEdit};

pub type WebSocketTcpStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub struct WebsocketClient {
    url: String,
    ws_stream: WebSocketTcpStream,
}

pub struct WebSocketSender {
    sink: SplitSink<WebSocketTcpStream, Message>,
}

pub struct WebSocketReceiver {
    pub stream: SplitStream<WebSocketTcpStream>,
}

impl WebsocketClient {
    /// Connect to a websocket server
    pub async fn connect(url: &str) -> Result<(WebsocketClient, Response<Option<Vec<u8>>>)> {
        Self::connect_with_headers(url, vec![]).await
    }

    /// Connect to a websocket server with custom headers
    pub async fn connect_with_headers(
        url: &str,
        headers: Vec<(String, String)>,
    ) -> Result<(WebsocketClient, Response<Option<Vec<u8>>>)> {
        let mut request = url.into_client_request().map_err(Self::error)?;

        for (key, value) in headers {
            request.headers_mut().insert(
                HeaderName::from_str(&key).map_err(Self::error)?,
                value.parse().map_err(Self::error)?,
            );
        }

        let (ws_stream, response) = connect_async(request).await.map_err(Self::error)?;

        Ok((
            WebsocketClient {
                url: url.into(),
                ws_stream,
            },
            response,
        ))
    }

    /// Send a message to the websocket server
    pub async fn send(&mut self, message: Message) -> Result<()> {
        let message = match message {
            Message::Text(text) => Message::text(text),
            Message::Binary(binary) => Message::binary(binary),
            _ => return Err(Self::error("Unsupported message type")),
        };

        self.ws_stream.send(message).await.map_err(Self::error)?;

        Ok(())
    }

    /// Send a text message to the websocket server
    pub async fn send_text(&mut self, message: &str) -> Result<()> {
        self.send(Message::text(message)).await
    }

    /// Send a binary message to the websocket server
    pub async fn send_binary(&mut self, message: &[u8]) -> Result<()> {
        self.send(Message::binary(message.to_vec())).await
    }

    /// Receive a message from the websocket server
    pub async fn receive(&mut self) -> Result<Option<Message>> {
        match self.ws_stream.next().await {
            Some(Ok(message)) => match message {
                Message::Text(text) => Ok(Some(Message::Text(text))),
                Message::Binary(binary) => Ok(Some(Message::Binary(binary))),
                _ => Ok(None),
            },
            Some(Err(e)) => Err(Self::error(e)),
            None => Ok(None), // Stream ended
        }
    }

    /// Get the URL this websocket is connected to
    pub fn url(&self) -> &str {
        &self.url
    }

    /// Split the websocket into separate sender and receiver
    pub fn split(self) -> (WebSocketSender, WebSocketReceiver) {
        let (sink, stream) = self.ws_stream.split();
        (WebSocketSender { sink }, WebSocketReceiver { stream })
    }

    /// Error helper
    fn error(e: impl ToString) -> SharedError {
        SharedError::Net(Net::WebsocketClient(e.to_string()))
    }
}

impl WebSocketSender {
    /// Send a message to the websocket server
    pub async fn send(&mut self, message: Message) -> Result<()> {
        let message = match message {
            Message::Text(text) => Message::text(text),
            Message::Binary(binary) => Message::binary(binary),
            _ => return Err(WebsocketClient::error("Unsupported message type")),
        };

        self.sink
            .send(message)
            .await
            .map_err(WebsocketClient::error)?;

        Ok(())
    }

    /// Send a text message to the websocket server
    pub async fn send_text(&mut self, message: &str) -> Result<()> {
        self.sink
            .send(Message::text(message))
            .await
            .map_err(WebsocketClient::error)?;
        Ok(())
    }

    /// Send a binary message to the websocket server
    pub async fn send_binary(&mut self, message: &[u8]) -> Result<()> {
        self.sink
            .send(Message::binary(message.to_vec()))
            .await
            .map_err(WebsocketClient::error)?;
        Ok(())
    }
}

impl WebSocketReceiver {
    /// Receive a text message from the websocket server
    pub async fn receive_text(&mut self) -> Result<Option<String>> {
        match self.stream.next().await {
            Some(Ok(Message::Text(text))) => Ok(Some(text.to_string())),
            Some(Ok(Message::Close(_))) => Ok(None),
            Some(Ok(_)) => Ok(None), // Ignore binary, ping, pong messages
            Some(Err(e)) => Err(WebsocketClient::error(e)),
            None => Ok(None), // Stream ended
        }
    }
}

// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
// pub struct EnterRoom {
//     r#type: String,
//     pub session_id: Uuid,
//     pub user_id: String,
//     pub file_id: Uuid,
//     first_name: String,
//     last_name: String,
//     email: String,
//     image: String,
//     pub sheet_id: Uuid,
//     selection: String,
//     cell_edit: CellEdit,
//     viewport: String,
//     follow: Option<String>,
// }

// #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
// pub struct CellEdit {
//     pub active: bool,
//     pub text: String,
//     pub cursor: u32,
//     pub code_editor: bool,
//     pub inline_code_editor: bool,
//     pub bold: Option<bool>,
//     pub italic: Option<bool>,
// }

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct BinaryTransaction {
    pub id: Uuid,
    pub session_id: Uuid,
    pub file_id: Uuid,
    pub operations: Vec<u8>,
}

pub fn get_authorization_header() -> String {
    dotenv::from_filename(".env.test").ok();
    let token = std::env::var("M2M_AUTH_TOKEN").unwrap_or("M2M_AUTH_TOKEN".into());
    format!("Bearer {}", token)
}

pub fn get_enter_room_message(user_id: Uuid, file_id: Uuid, session_id: Uuid) -> MessageRequest {
    MessageRequest::EnterRoom {
        session_id,
        user_id: user_id.to_string(),
        file_id,
        first_name: "Quadratic".to_string(),
        last_name: "Cloud Worker".to_string(),
        email: "cloud-worker@quadratichq.com".to_string(),
        image: "https://quadratichq.com//favicon.ico".to_string(),
        sheet_id: Uuid::new_v4(),
        selection: "".to_string(),
        cell_edit: CellEdit::default(),
        viewport: "".to_string(),
        follow: None,
    }
}

pub fn get_heartbeat_message(session_id: Uuid, file_id: Uuid) -> MessageRequest {
    MessageRequest::Heartbeat {
        session_id,
        file_id,
    }
}

pub fn get_leave_room_message(session_id: Uuid, file_id: Uuid) -> MessageRequest {
    MessageRequest::LeaveRoom {
        session_id,
        file_id,
    }
}

pub fn get_transactions_message(
    file_id: Uuid,
    session_id: Uuid,
    min_sequence_num: u64,
) -> MessageRequest {
    MessageRequest::GetTransactions {
        file_id,
        session_id,
        min_sequence_num,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Router,
        extract::ws::{WebSocket, WebSocketUpgrade},
        response::IntoResponse,
        routing::get,
    };
    use http::StatusCode;
    use std::net::{Ipv4Addr, SocketAddr};
    use tokio::net::TcpListener;

    use crate::multiplayer::message::response::MessageResponse;

    // Helper functions for testing websocket client functionality.
    // Similar to net::websocket_server::test_util::integration_test_setup, but returns
    // a URL so we can test the WebsocketClient connection logic.

    /// Creates a simple ping/pong router for testing
    fn create_ping_pong_router() -> Router {
        async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
            ws.on_upgrade(handle_socket)
        }

        async fn handle_socket(mut socket: WebSocket) {
            while let Some(Ok(msg)) = socket.recv().await {
                if let axum::extract::ws::Message::Text(text) = msg {
                    // Parse the incoming message
                    if let Ok(request) = serde_json::from_str::<MessageRequest>(&text) {
                        match request {
                            MessageRequest::Ping { message } => {
                                // Respond with pong
                                let response = MessageResponse::Pong { message };
                                let response_text = serde_json::to_string(&response)
                                    .expect("Failed to serialize response");
                                if socket
                                    .send(axum::extract::ws::Message::Text(response_text.into()))
                                    .await
                                    .is_err()
                                {
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        Router::new().route("/ws", get(ws_handler))
    }

    /// Creates a test websocket server on a random localhost port.
    /// Returns the WebSocket URL to connect to and a handle to the server task.
    /// The server automatically handles ping/pong messages for testing.
    async fn create_test_server() -> (String, tokio::task::JoinHandle<()>) {
        let app = create_ping_pong_router();

        let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
            .await
            .expect("Failed to bind test server");
        let addr = listener.local_addr().expect("Failed to get local address");

        let handle = tokio::spawn(async move {
            axum::serve(listener, app.into_make_service())
                .await
                .expect("Failed to start test server");
        });

        // Give the server a moment to start
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        (format!("ws://{}:{}/ws", addr.ip(), addr.port()), handle)
    }

    #[tokio::test]
    async fn test_websocket_connection_error() {
        let invalid_url = "ws://invalid-url-that-does-not-exist:12345/ws";
        let result = WebsocketClient::connect(invalid_url).await;
        assert!(result.is_err(), "Connection to invalid URL should fail");
    }

    #[tokio::test]
    async fn test_websocket_url() {
        // Test that we can create a connection error without panicking
        let invalid_url = "ws://localhost:99999/ws";
        match WebsocketClient::connect(invalid_url).await {
            Ok(_) => panic!("Should not connect to invalid URL"),
            Err(e) => {
                // Verify error is properly wrapped
                assert!(matches!(e, SharedError::Net(Net::WebsocketClient(_))));
            }
        }
    }

    #[tokio::test]
    async fn test_websocket_error_helper() {
        let error = WebsocketClient::error("test error");
        match error {
            SharedError::Net(Net::WebsocketClient(msg)) => {
                assert_eq!(msg, "test error");
            }
            _ => panic!("Wrong error type"),
        }
    }

    #[tokio::test]
    async fn test_websocket_send_and_receive() {
        let (url, _handle) = create_test_server().await;

        let (mut websocket, response) = WebsocketClient::connect(&url)
            .await
            .expect("Failed to connect to test server");

        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);

        let message = MessageRequest::Ping {
            message: "test".to_string(),
        };
        let serialized_message =
            serde_json::to_string(&message).expect("Failed to serialize message");

        let expected_response = MessageResponse::Pong {
            message: "test".to_string(),
        };
        let serialized_response =
            serde_json::to_string(&expected_response).expect("Failed to serialize response");

        websocket
            .send_text(&serialized_message)
            .await
            .expect("Failed to send message");

        match websocket.receive().await {
            Ok(Some(Message::Text(text))) => {
                assert_eq!(text, serialized_response);
            }
            Ok(Some(other)) => panic!("Expected text message, got {:?}", other),
            Ok(None) => panic!("Expected message, got None"),
            Err(e) => panic!("Failed to receive message: {:?}", e),
        }
    }

    #[tokio::test]
    async fn test_websocket_connect_with_headers() {
        let (url, _handle) = create_test_server().await;

        let headers = vec![
            ("Authorization".to_string(), "Bearer test-token".to_string()),
            ("X-Custom-Header".to_string(), "test-value".to_string()),
        ];

        let (result, response) = WebsocketClient::connect_with_headers(&url, headers)
            .await
            .expect("Failed to connect to test server");

        assert_eq!(result.url(), url);
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);
    }

    #[tokio::test]
    async fn test_websocket_split() {
        let (url, _handle) = create_test_server().await;

        let (websocket, _) = WebsocketClient::connect(&url)
            .await
            .expect("Failed to connect to test server");

        let (mut sender, mut receiver) = websocket.split();

        // Send a ping message
        let message = MessageRequest::Ping {
            message: "split test".to_string(),
        };
        let serialized = serde_json::to_string(&message).expect("Failed to serialize message");

        sender
            .send_text(&serialized)
            .await
            .expect("Failed to send message");

        // Receive the pong response
        match receiver.receive_text().await {
            Ok(Some(text)) => {
                let response: MessageResponse =
                    serde_json::from_str(&text).expect("Failed to parse response");
                match response {
                    MessageResponse::Pong { message } => {
                        assert_eq!(message, "split test");
                    }
                    _ => panic!("Expected Pong response"),
                }
            }
            Ok(None) => panic!("Expected message, got None"),
            Err(e) => panic!("Failed to receive message: {:?}", e),
        }
    }
}
