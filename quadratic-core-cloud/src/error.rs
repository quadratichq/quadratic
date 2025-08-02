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
use quadratic_rust_shared::{SharedError, clean_errors, storage::error::Storage as StorageError};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub(crate) type Result<T> = std::result::Result<T, CoreCloudError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum CoreCloudError {
    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Background service error: {0}")]
    BackgroundService(String),

    #[error("Internal server error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Unable to export file {0}: {1}")]
    ExportFile(String, String),

    #[error("Unable to import file {0}: {1}")]
    ImportFile(String, String),

    #[error("Internal server error: {0}")]
    InternalServer(String),

    #[error("Unable to load file {0}: {1}")]
    LoadFile(String, String),

    #[error("Not Found: {0}")]
    NotFound(String),

    #[error("PubSub error: {0}")]
    PubSub(String),

    #[error("QuadraticApi error: {0}")]
    QuadraticApi(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Error in S3: {0}")]
    S3(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Transaction queue error: {0}")]
    TransactionQueue(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

// Convert CoreCloudErrors into readable responses with appropriate status codes.
// These are the errors that are returned to the client.
impl IntoResponse for CoreCloudError {
    fn into_response(self) -> Response {
        let (status, error) = match &self {
            CoreCloudError::Authentication(error) => {
                (StatusCode::UNAUTHORIZED, clean_errors(error))
            }
            CoreCloudError::InternalServer(error) => {
                (StatusCode::INTERNAL_SERVER_ERROR, clean_errors(error))
            }
            CoreCloudError::NotFound(error) => (StatusCode::NOT_FOUND, clean_errors(error)),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "Unknown".into()),
        };

        tracing::warn!("{:?}", self);

        (status, error).into_response()
    }
}

impl From<SharedError> for CoreCloudError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::Auth(error) => CoreCloudError::Authentication(error.to_string()),
            SharedError::Aws(error) => CoreCloudError::S3(error.to_string()),
            SharedError::PubSub(error) => CoreCloudError::PubSub(error),
            SharedError::QuadraticApi(error) => CoreCloudError::QuadraticApi(error),
            SharedError::Storage(error) => match error {
                StorageError::Read(key, _) => {
                    CoreCloudError::NotFound(format!("File {key} not found"))
                }
                _ => CoreCloudError::Storage(error.to_string()),
            },
            _ => CoreCloudError::Unknown(format!("Unknown SharedError: {error}")),
        }
    }
}

impl From<serde_json::Error> for CoreCloudError {
    fn from(error: serde_json::Error) -> Self {
        CoreCloudError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for CoreCloudError {
    fn from(error: uuid::Error) -> Self {
        CoreCloudError::Unknown(error.to_string())
    }
}

impl From<reqwest::Error> for CoreCloudError {
    fn from(error: reqwest::Error) -> Self {
        CoreCloudError::Request(error.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for CoreCloudError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        CoreCloudError::Authentication(error.to_string())
    }
}

impl From<prost::DecodeError> for CoreCloudError {
    fn from(error: prost::DecodeError) -> Self {
        CoreCloudError::Serialization(error.to_string())
    }
}
