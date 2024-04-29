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

pub(crate) type Result<T> = std::result::Result<T, ConnectorError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub(crate) enum ConnectorError {
    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Internal server error: {0}")]
    Config(String),

    #[error("Internal server error: {0}")]
    InternalServer(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

impl From<SharedError> for ConnectorError {
    fn from(error: SharedError) -> Self {
        match error {
            _ => ConnectorError::Unknown(format!("Unknown Quadratic API error: {error}")),
        }
    }
}

impl From<serde_json::Error> for ConnectorError {
    fn from(error: serde_json::Error) -> Self {
        ConnectorError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for ConnectorError {
    fn from(error: uuid::Error) -> Self {
        ConnectorError::Unknown(error.to_string())
    }
}

impl From<reqwest::Error> for ConnectorError {
    fn from(error: reqwest::Error) -> Self {
        ConnectorError::Request(error.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for ConnectorError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        ConnectorError::Authentication(error.to_string())
    }
}

// convert ConnectorErrors into readable responses with appropriate status codes
impl IntoResponse for ConnectorError {
    fn into_response(self) -> Response {
        let (status, error) = match self {
            ConnectorError::InternalServer(error) => (StatusCode::INTERNAL_SERVER_ERROR, error),
            ConnectorError::Authentication(error) => (StatusCode::UNAUTHORIZED, error),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "Unknown".into()),
        };

        (status, error).into_response()
    }
}
