use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::ErrorLevel;

pub type Result<T, E = WebsocketServerError> = std::result::Result<T, E>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum WebsocketServerError {
    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("User {0} not found: {1}")]
    UserNotFound(String, String),

    #[error("File permissions error: {0}")]
    FilePermissions(String),

    #[error("Room not found: {0}")]
    RoomNotFound(String),

    #[error("Error sending message: {0}")]
    SendingMessage(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),
}

impl From<crate::error::SharedError> for WebsocketServerError {
    fn from(error: crate::error::SharedError) -> Self {
        WebsocketServerError::Authentication(error.to_string())
    }
}

impl From<&WebsocketServerError> for ErrorLevel {
    fn from(error: &WebsocketServerError) -> Self {
        match error {
            WebsocketServerError::Authentication(_) => ErrorLevel::Error,
            _ => ErrorLevel::Warning,
        }
    }
}

impl From<serde_json::Error> for WebsocketServerError {
    fn from(error: serde_json::Error) -> Self {
        WebsocketServerError::Serialization(error.to_string())
    }
}
