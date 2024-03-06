//! Error Handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.
//! Convert errors to responses.

use quadratic_rust_shared::{Aws, SharedError};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub(crate) type Result<T> = std::result::Result<T, FilesError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub(crate) enum FilesError {
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

    #[error("Unable to load file {0} from bucket {1}: {2}")]
    LoadFile(String, String, String),

    #[error("PubSub error: {0}")]
    PubSub(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Error in S3: {0}")]
    S3(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("Transaction queue error: {0}")]
    TransactionQueue(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

impl From<SharedError> for FilesError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::Aws(aws) => match aws {
                Aws::S3(error) => FilesError::S3(error),
            },
            SharedError::PubSub(error) => FilesError::PubSub(error),
            _ => FilesError::Unknown(format!("Unknown Quadratic API error: {error}")),
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
