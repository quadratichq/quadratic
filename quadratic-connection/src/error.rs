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
use quadratic_rust_shared::{SharedError, clean_errors};
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

    #[error("Error creating object store: {0}")]
    CreateObjectStore(String),

    #[error("Header error: {0}")]
    Header(String),

    #[error("Internal server error: {0}")]
    InternalServer(String),

    #[error("Internal token: {0}")]
    InvalidToken(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Error parsing: {0}")]
    Parse(String),

    #[error("Proxy error: {0}")]
    Proxy(String),

<<<<<<< HEAD
    #[error("Error communicating with the Quadratic API: {0}")]
=======
    #[error("Quadratic API error: {0}")]
>>>>>>> origin/google-analytics-connection
    QuadraticApi(String),

    #[error("Query error: {0}")]
    Query(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Synced error: {0}")]
    Synced(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

pub(crate) fn proxy_error(e: impl ToString) -> ConnectionError {
    ConnectionError::Proxy(e.to_string())
}

pub(crate) fn header_error(e: impl ToString) -> ConnectionError {
    ConnectionError::Header(e.to_string())
}

impl From<SharedError> for ConnectionError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::Auth(error) => ConnectionError::Authentication(error.to_string()),
            SharedError::Sql(error) => ConnectionError::Query(error.to_string()),
            SharedError::QuadraticApi(error) => ConnectionError::QuadraticApi(error.to_string()),

            // Data format errors
            SharedError::Arrow(error) => ConnectionError::Query(format!("Arrow error: {}", error)),
            SharedError::Parquet(error) => {
                ConnectionError::Query(format!("Parquet error: {}", error))
            }

            // Infrastructure errors
            SharedError::Storage(error) => ConnectionError::Storage(error.to_string()),
            SharedError::Net(error) => ConnectionError::Network(error.to_string()),
            SharedError::Synced(error) => ConnectionError::Synced(error.to_string()),

            // Generic errors
            SharedError::Serialization(error) => {
                ConnectionError::Unknown(format!("Serialization error: {}", error))
            }
            SharedError::Request(error) => {
                ConnectionError::Unknown(format!("Request error: {}", error))
            }
            SharedError::Uuid(error) => ConnectionError::Unknown(format!("UUID error: {}", error)),
            SharedError::Generic(error) => ConnectionError::Unknown(error),

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
            // 400 Bad Request - Client Errors
            ConnectionError::Query(error)
            | ConnectionError::Proxy(error)
            | ConnectionError::Header(error)
            | ConnectionError::Parse(error) => (StatusCode::BAD_REQUEST, clean_errors(error)),

            // 401 Unauthorized - Auth Errors
            ConnectionError::Authentication(error) | ConnectionError::InvalidToken(error) => {
                (StatusCode::UNAUTHORIZED, clean_errors(error))
            }

            // 404 Not Found - Resource Not Found
            ConnectionError::Connection(error) => (StatusCode::NOT_FOUND, clean_errors(error)),

            // 424 Failed Dependency - External Service Errors
            ConnectionError::Ssh(error)
            | ConnectionError::Request(error)
            | ConnectionError::Network(error)
            | ConnectionError::CreateObjectStore(error) => {
                (StatusCode::FAILED_DEPENDENCY, clean_errors(error))
            }

            // 500 Internal Server Error - Server Errors
            ConnectionError::InternalServer(error)
            | ConnectionError::Config(error)
            | ConnectionError::Serialization(error)
            | ConnectionError::Storage(error)
            | ConnectionError::Synced(error)
            | ConnectionError::Unknown(error)
            | ConnectionError::QuadraticApi(error) => {
                (StatusCode::INTERNAL_SERVER_ERROR, clean_errors(error))
            }
        };

        tracing::warn!("{} {}: {:?}", status, error, self);

        (status, error).into_response()
    }
}
