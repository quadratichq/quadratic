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
use uuid::Uuid;

pub(crate) type Result<T> = std::result::Result<T, FilesError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum FilesError {
    #[error("Sequence number not found in API for file {0}: {1}")]
    ApiSequenceNumberNotFound(Uuid, String),

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Background service error: {0}")]
    BackgroundService(String),

    #[error("Internal server error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Error creating object store: {0}")]
    CreateObjectStore(String),

    #[error("Data pipeline error: {0}")]
    DataPipeline(String),

    #[error("Error connecting to database: {0}")]
    DatabaseConnect(String),

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

    #[error("File storage error: {0}")]
    Storage(String),

    #[error("Synced connection error: {0}")]
    SyncedConnection(String),

    #[error("Transaction queue error: {0}")]
    TransactionQueue(String),

    #[error("Error truncating files: {0}")]
    Truncate(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

// Convert FilesErrors into readable responses with appropriate status codes.
// These are the errors that are returned to the client.
impl IntoResponse for FilesError {
    fn into_response(self) -> Response {
        let (status, error) = match &self {
            FilesError::Authentication(error) => (StatusCode::UNAUTHORIZED, clean_errors(error)),
            FilesError::InternalServer(error) => {
                (StatusCode::INTERNAL_SERVER_ERROR, clean_errors(error))
            }
            FilesError::NotFound(error) => (StatusCode::NOT_FOUND, clean_errors(error)),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, "Unknown".into()),
        };

        tracing::warn!("{:?}", self);

        (status, error).into_response()
    }
}

impl From<SharedError> for FilesError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::Auth(error) => FilesError::Authentication(error.to_string()),
            SharedError::Aws(error) => FilesError::S3(error.to_string()),
            SharedError::PubSub(error) => FilesError::PubSub(error),
            SharedError::QuadraticApi(error) => FilesError::QuadraticApi(error),
            SharedError::Storage(error) => match error {
                StorageError::Read(key, _) => FilesError::NotFound(format!("File {key} not found")),
                _ => FilesError::Storage(error.to_string()),
            },
            _ => FilesError::Unknown(format!("Unknown SharedError: {error}")),
        }
    }
}

impl From<serde_json::Error> for FilesError {
    fn from(error: serde_json::Error) -> Self {
        FilesError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for FilesError {
    fn from(error: uuid::Error) -> Self {
        FilesError::Unknown(error.to_string())
    }
}

impl From<reqwest::Error> for FilesError {
    fn from(error: reqwest::Error) -> Self {
        FilesError::Request(error.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for FilesError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        FilesError::Authentication(error.to_string())
    }
}
