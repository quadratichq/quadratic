use std::str::FromStr;

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{
        client::IntoClientRequest,
        http::{HeaderName, Response},
        protocol::Message,
    },
};

use crate::SharedError;
use crate::error::Result;
use crate::net::error::Net;

pub struct Websocket {
    url: String,
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
}

impl Websocket {
    /// Connect to a websocket server
    pub async fn connect(url: &str) -> Result<(Websocket, Response<Option<Vec<u8>>>)> {
        Self::connect_with_headers(url, vec![]).await
    }

    /// Connect to a websocket server with custom headers
    pub async fn connect_with_headers(
        url: &str,
        headers: Vec<(String, String)>,
    ) -> Result<(Websocket, Response<Option<Vec<u8>>>)> {
        let mut request = url.into_client_request().map_err(Self::error)?;

        for (key, value) in headers {
            request.headers_mut().insert(
                HeaderName::from_str(&key).map_err(Self::error)?,
                value.parse().map_err(Self::error)?,
            );
        }

        let (ws_stream, response) = connect_async(request).await.map_err(Self::error)?;
        Ok((
            Websocket {
                url: url.to_string(),
                ws_stream,
            },
            response,
        ))
    }

    /// Send a message to the websocket server
    pub async fn send(&mut self, message: &str) -> Result<()> {
        self.ws_stream
            .send(Message::text(message))
            .await
            .map_err(Self::error)?;
        Ok(())
    }

    /// Receive a message from the websocket server
    pub async fn receive(&mut self) -> Result<Option<String>> {
        match self.ws_stream.next().await {
            Some(Ok(Message::Text(text))) => Ok(Some(text.to_string())),
            Some(Ok(Message::Close(_))) => Ok(None),
            Some(Ok(_)) => Ok(None), // Ignore binary, ping, pong messages
            Some(Err(e)) => Err(Self::error(e)),
            None => Ok(None), // Stream ended
        }
    }

    /// Get the URL this websocket is connected to
    pub fn url(&self) -> &str {
        &self.url
    }

    /// Error helper
    fn error(e: impl ToString) -> SharedError {
        SharedError::Net(Net::Websocket(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use http::StatusCode;
    use serde::{Deserialize, Serialize};
    use uuid::Uuid;

    use super::*;

    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
    struct EnterRoom {
        r#type: String,
        session_id: Uuid,
        user_id: String,
        file_id: Uuid,
        first_name: String,
        last_name: String,
        email: String,
        image: String,
        sheet_id: Uuid,
        selection: String,
        cell_edit: CellEdit,
        viewport: String,
        follow: Option<String>,
    }

    #[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
    struct CellEdit {
        pub active: bool,
        pub text: String,
        pub cursor: u32,
        pub code_editor: bool,
        pub inline_code_editor: bool,
        pub bold: Option<bool>,
        pub italic: Option<bool>,
    }

    fn get_authorization_header() -> String {
        dotenv::from_filename(".env.test").ok();
        let token = std::env::var("M2M_AUTH_TOKEN").unwrap_or("M2M_AUTH_TOKEN".into());
        format!("Bearer {}", token)
    }

    #[tokio::test]
    async fn test_websocket_send_and_receive() {
        let url = "ws://127.0.0.1:3001/ws";
        let headers = vec![("Authorization".to_string(), get_authorization_header())];
        let (mut websocket, response) =
            Websocket::connect_with_headers(url, headers).await.unwrap();
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);

        let message = EnterRoom {
            r#type: "EnterRoom".to_string(),
            session_id: Uuid::new_v4(),
            user_id: "test".to_string(),
            file_id: Uuid::new_v4(),
            first_name: "Test".to_string(),
            last_name: "User".to_string(),
            email: "test@test.com".to_string(),
            image: "https://test.com/image.png".to_string(),
            sheet_id: Uuid::new_v4(),
            selection: "".to_string(),
            cell_edit: CellEdit::default(),
            viewport: "".to_string(),
            follow: None,
        };

        let serialized_message = serde_json::to_string(&message).unwrap();
        println!("Serialized message: {}", serialized_message);

        websocket
            .send(&serialized_message)
            .await
            .expect("Failed to send message");

        if let Ok(Some(received)) = websocket.receive().await {
            assert_eq!(
                received, serialized_message,
                "Received message should match sent message"
            );
        }
    }

    #[tokio::test]
    async fn test_websocket_connection_error() {
        let invalid_url = "ws://invalid-url-that-does-not-exist:12345/ws";
        let result = Websocket::connect(invalid_url).await;
        assert!(result.is_err(), "Connection to invalid URL should fail");
    }

    #[tokio::test]
    async fn test_websocket_connect_with_headers() {
        let url = "ws://127.0.0.1:3001/ws";
        let headers = vec![
            ("Authorization".to_string(), "Bearer test-token".to_string()),
            ("X-Custom-Header".to_string(), "test-value".to_string()),
        ];

        let (result, response) = Websocket::connect_with_headers(url, headers).await.unwrap();
        let get_header = |header: &str| response.headers().get(header).unwrap().to_str().unwrap();
        assert_eq!(result.url(), url);
        assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);
        assert_eq!(get_header("X-Custom-Header"), "test-value");
        assert_eq!(get_header("Authorization"), "Bearer test-token");
    }
}
