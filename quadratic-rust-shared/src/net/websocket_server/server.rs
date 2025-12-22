//! Websocket Server
//!
//! Handle bootstrapping and starting the websocket server.  Adds global state
//! to be shared across all requests and threads.  Adds tracing/logging.

use axum::{
    extract::ws::{Message, WebSocket},
    http::HeaderMap,
};
use axum_extra::TypedHeader;
use bytes::Bytes;
use futures::stream::SplitSink;
use futures_util::SinkExt;
use serde::Serialize;
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::Mutex;

use crate::auth::jwt::Claims;
use crate::auth::jwt::{authorize, extract_m2m_token};
use crate::net::websocket_server::error::{Result, WebsocketServerError};
use crate::net::websocket_server::pre_connection::PreConnection;

pub type SplitSinkSocket = Arc<Mutex<SplitSink<WebSocket, Message>>>;
pub type SharedSplitSinkSocket = Arc<Mutex<SplitSink<WebSocket, Message>>>;

pub struct WebsocketServer {}

impl WebsocketServer {
    // Handle the websocket upgrade from http.
    pub fn authenticate(
        user_agent: Option<TypedHeader<headers::UserAgent>>,
        addr: SocketAddr,
        cookie: Option<TypedHeader<headers::Cookie>>,
        headers: HeaderMap,
        authenticate_jwt: bool,
        jwks: Option<jsonwebtoken::jwk::JwkSet>,
        jwt_override: Option<String>,
    ) -> Result<PreConnection> {
        let auth_error = |error: &str| WebsocketServerError::Authentication(error.to_string());

        let user_agent = user_agent.map_or("Unknown user agent".into(), |user_agent| {
            user_agent.to_string()
        });
        let addr = addr.to_string();

        let mut jwt = jwt_override;

        if authenticate_jwt && jwt.is_none() {
            let jwks = jwks.ok_or_else(|| auth_error("No JWKS found"))?;

            // validate the JWT or ignore for anonymous users if it doesn't exist
            let result = {
                let cookie = cookie.ok_or_else(|| auth_error("No cookie found"))?;
                if let Some(token) = cookie.get("jwt") {
                    authorize::<Claims>(&jwks, token, false, true)?;

                    jwt = Some(token.to_owned());

                    Ok::<_, WebsocketServerError>(())
                } else {
                    // this is for anonymous users
                    Ok::<_, WebsocketServerError>(())
                }
            };

            if let Err(error) = result {
                tracing::warn!("Error authorizing user: {:?}", error);
                return Err(WebsocketServerError::Authentication(
                    "Invalid token".to_string(),
                ));
            }
        }

        // check if the connection is m2m service connection
        // strip "Bearer " from the token
        let m2m_token = extract_m2m_token(&headers);
        let pre_connection = PreConnection::new(jwt, m2m_token);

        tracing::info!(
            "New connection {}, `{user_agent}` at {addr}, is_m2m={}",
            pre_connection.id,
            pre_connection.m2m_token.is_some()
        );

        Ok(pre_connection)
    }

    pub async fn send_text<T: Serialize>(sender: SplitSinkSocket, message: T) -> Result<()> {
        let text = serde_json::to_string(&message)?;

        (*sender.lock().await)
            .send(Message::Text(text.into()))
            .await
            .map_err(|e| WebsocketServerError::SendingMessage(e.to_string()))
    }

    pub async fn send_binary(sender: SplitSinkSocket, message: Bytes) -> Result<()> {
        (*sender.lock().await)
            .send(Message::Binary(message))
            .await
            .map_err(|e| WebsocketServerError::SendingMessage(e.to_string()))
    }
}

#[cfg(test)]
pub(crate) mod tests {}
