//! Error Handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.

use quadratic_rust_shared::{
    ErrorLevel, SharedError, net::websocket_server::error::WebsocketServerError,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub(crate) type Result<T> = std::result::Result<T, CoreCloudError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum CoreCloudError {
    #[error("Async error: {0}")]
    Async(String),

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Background service error: {0}")]
    BackgroundService(String),

    #[error("Channel error: {0}")]
    Channel(String),

    #[error("Internal server error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Core error: {0}")]
    Core(String),

    #[error("Unable to export file {0}: {1}")]
    ExportFile(String, String),

    #[error("Javascript error: {0}")]
    Javascript(String),

    #[error("Unable to import file {0}: {1}")]
    ImportFile(String, String),

    #[error("Unable to load file {0}: {1}")]
    LoadFile(String, String),

    #[error("Multiplayer error: {0}")]
    Multiplayer(String),

    #[error("Python error: {0}")]
    Python(String),

    #[error("Python timeout")]
    PythonTimeout,

    #[error("Receiving message error: {0}")]
    ReceivingMessage(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Error sending message: {0}")]
    SendingMessage(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("unknown error: {0}")]
    Unknown(String),
}

impl From<SharedError> for CoreCloudError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::Storage(error) => match error {
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

impl From<prost::DecodeError> for CoreCloudError {
    fn from(error: prost::DecodeError) -> Self {
        CoreCloudError::Serialization(error.to_string())
    }
}

impl From<pyo3::PyErr> for CoreCloudError {
    fn from(error: pyo3::PyErr) -> Self {
        CoreCloudError::Python(error.to_string())
    }
}

impl<T> From<std::sync::PoisonError<std::sync::MutexGuard<'_, T>>> for CoreCloudError {
    fn from(error: std::sync::PoisonError<std::sync::MutexGuard<'_, T>>) -> Self {
        CoreCloudError::Async(error.to_string())
    }
}

impl<T> From<tokio::sync::mpsc::error::SendError<T>> for CoreCloudError {
    fn from(error: tokio::sync::mpsc::error::SendError<T>) -> Self {
        CoreCloudError::Channel(error.to_string())
    }
}

impl From<&CoreCloudError> for ErrorLevel {
    fn from(error: &CoreCloudError) -> Self {
        match error {
            CoreCloudError::Authentication(_) => ErrorLevel::Error,
            _ => ErrorLevel::Warning,
        }
    }
}

impl From<WebsocketServerError> for CoreCloudError {
    fn from(error: WebsocketServerError) -> Self {
        match error {
            WebsocketServerError::Authentication(msg) => CoreCloudError::Authentication(msg),
            WebsocketServerError::SendingMessage(msg) => CoreCloudError::SendingMessage(msg),
            _ => CoreCloudError::Unknown(error.to_string()),
        }
    }
}
