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
    use http::StatusCode;

    use crate::multiplayer::message::response::MessageResponse;

    use super::*;

    #[tokio::test]
    async fn test_websocket_send_and_receive() {
        let url = "ws://127.0.0.1:3001/ws";
        let headers = vec![("Authorization".to_string(), get_authorization_header())];
        let (mut websocket, response) = WebsocketClient::connect_with_headers(url, headers)
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);

        let message = MessageRequest::Ping {
            message: "test".to_string(),
        };
        let serialized_message = serde_json::to_string(&message).unwrap();

        let response = MessageResponse::Pong {
            message: "test".to_string(),
        };
        let serialized_response = serde_json::to_string(&response).unwrap();
        websocket
            .send_text(&serialized_message)
            .await
            .expect("Failed to send message");

        if let Ok(Some(received)) = websocket.receive().await {
            match received {
                Message::Text(text) => assert_eq!(text, serialized_response),
                _ => panic!("Received message should be text"),
            }
        }
    }

    #[tokio::test]
    async fn test_websocket_connection_error() {
        let invalid_url = "ws://invalid-url-that-does-not-exist:12345/ws";
        let result = WebsocketClient::connect(invalid_url).await;
        assert!(result.is_err(), "Connection to invalid URL should fail");
    }

    #[tokio::test]
    async fn test_websocket_connect_with_headers() {
        let url = "ws://127.0.0.1:3001/ws";
        let headers = vec![
            ("Authorization".to_string(), "Bearer test-token".to_string()),
            ("X-Custom-Header".to_string(), "test-value".to_string()),
        ];

        let (result, response) = WebsocketClient::connect_with_headers(url, headers)
            .await
            .unwrap();

        assert_eq!(result.url(), url);
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);
    }
}
