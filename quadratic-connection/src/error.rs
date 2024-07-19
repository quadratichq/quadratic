//! Error Handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.
//! Convert errors to responses.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use quadratic_rust_shared::SharedError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub(crate) type Result<T> = std::result::Result<T, ConnectionError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum ConnectionError {
    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Internal server error: {0}")]
    InternalServer(String),

    #[error("Internal token: {0}")]
    InvalidToken(String),

    #[error("Proxy error: {0}")]
    Proxy(String),

    #[error("Query error: {0}")]
    Query(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

pub(crate) fn proxy_error(e: impl ToString) -> ConnectionError {
    ConnectionError::Proxy(e.to_string())
}

fn clean_errors(error: impl ToString) -> String {
    let mut cleaned = error.to_string();
    let remove = vec!["error returned from database: "];

    for r in remove {
        cleaned = format!("{:?}", cleaned).replace(r, "");
    }

    cleaned
}

impl From<SharedError> for ConnectionError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::Auth(error) => ConnectionError::Authentication(error.to_string()),
            SharedError::Sql(error) => ConnectionError::Query(error.to_string()),
            SharedError::QuadraticApi(error) => ConnectionError::Connection(error.to_string()),
            _ => ConnectionError::Unknown(error.to_string()),
        }
    }
}

impl From<serde_json::Error> for ConnectionError {
    fn from(error: serde_json::Error) -> Self {
        ConnectionError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for ConnectionError {
    fn from(error: uuid::Error) -> Self {
        ConnectionError::Unknown(error.to_string())
    }
}

impl From<reqwest::Error> for ConnectionError {
    fn from(error: reqwest::Error) -> Self {
        ConnectionError::Request(error.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for ConnectionError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        ConnectionError::Authentication(error.to_string())
    }
}

// Convert ConnectionErrors into readable responses with appropriate status codes.
// These are the errors that are returned to the client.
impl IntoResponse for ConnectionError {
    fn into_response(self) -> Response {
        let (status, error) = match &self {
            ConnectionError::InternalServer(error) => {
                (StatusCode::INTERNAL_SERVER_ERROR, clean_errors(error))
            }
            ConnectionError::Authentication(error) | ConnectionError::InvalidToken(error) => {
                (StatusCode::UNAUTHORIZED, clean_errors(error))
            }
            ConnectionError::Query(error) => (StatusCode::BAD_REQUEST, clean_errors(error)),
            ConnectionError::Connection(error) => (StatusCode::NOT_FOUND, clean_errors(error)),
            ConnectionError::Proxy(error) => (StatusCode::BAD_REQUEST, clean_errors(error)),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "Unknown".into()),
        };

        tracing::warn!("{} {}: {:?}", status, error, self);

        (status, error).into_response()
    }
}
