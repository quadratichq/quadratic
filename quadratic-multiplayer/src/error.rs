//! Error Handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.
//! Convert errors to responses.

use quadratic_rust_shared::{
    ErrorLevel, SharedError, aws::error::Aws as AwsError,
    net::websocket_server::error::WebsocketServerError,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub(crate) type Result<T> = std::result::Result<T, MpError>;

impl From<&MpError> for ErrorLevel {
    fn from(error: &MpError) -> Self {
        match error {
            MpError::PubSub(_) => ErrorLevel::Error,
            _ => ErrorLevel::Warning,
        }
    }
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub(crate) enum MpError {
    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Background service error: {0}")]
    BackgroundService(String),

    #[error("Internal server error: {0}")]
    Config(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("File permissions error: {0}")]
    FilePermissions(String),

    #[error("File service error: {0}")]
    FileService(String),

    #[error("Internal server error: {0}")]
    InternalServer(String),

    #[error("Requested {0} transactions but only found {1}")]
    MissingTransactions(String, String),

    #[error("PubSub error: {0}")]
    PubSub(String),

    #[error("Error receiving message: {0}")]
    ReceivingMessage(String),

    #[error("Error requesting data: {0}")]
    Request(String),

    #[error("Room error: {0}")]
    Room(String),

    #[error("Room {0} not found")]
    RoomNotFound(String),

    #[error("Error in S3: {0}")]
    S3(String),

    #[error("Error sending message: {0}")]
    SendingMessage(String),

    #[error("Sequence number mismatch")]
    SequenceNumberMismatch,

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("Transaction queue error: {0}")]
    TransactionQueue(String),

    #[error("unknown error: {0}")]
    Unknown(String),

    #[error("User error: {0}")]
    User(String),

    #[error("User {0} not found in room {1}")]
    UserNotFound(Uuid, Uuid),
}

impl From<SharedError> for MpError {
    fn from(error: SharedError) -> Self {
        match error {
            SharedError::QuadraticApi(error) => MpError::FilePermissions(error),
            SharedError::Aws(aws) => match aws {
                AwsError::S3(error) => MpError::S3(error),
            },
            SharedError::PubSub(error) => MpError::PubSub(error),
            _ => MpError::Unknown(format!("Unknown Quadratic API error: {error}")),
        }
    }
}

impl From<serde_json::Error> for MpError {
    fn from(error: serde_json::Error) -> Self {
        MpError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for MpError {
    fn from(error: uuid::Error) -> Self {
        MpError::Unknown(error.to_string())
    }
}

impl From<reqwest::Error> for MpError {
    fn from(error: reqwest::Error) -> Self {
        MpError::Request(error.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for MpError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        MpError::Authentication(error.to_string())
    }
}

impl From<prost::DecodeError> for MpError {
    fn from(error: prost::DecodeError) -> Self {
        MpError::Serialization(error.to_string())
    }
}

impl From<WebsocketServerError> for MpError {
    fn from(error: WebsocketServerError) -> Self {
        match error {
            WebsocketServerError::Authentication(error) => MpError::Authentication(error),
            WebsocketServerError::SendingMessage(error) => MpError::SendingMessage(error),
            WebsocketServerError::FilePermissions(error) => MpError::FilePermissions(error),
            WebsocketServerError::Serialization(error) => MpError::Serialization(error),
            _ => MpError::Unknown(error.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    #[tokio::test]
    async fn test_error_level_conversions_and_logs() {
        let mp_error = MpError::PubSub("pubsub error".into());
        let error_level = ErrorLevel::from(&mp_error);
        error_level.log("test log");
        assert!(matches!(error_level, ErrorLevel::Error));

        let mp_error = MpError::RoomNotFound("room error".into());
        let error_level = ErrorLevel::from(&mp_error);
        error_level.log("test log");
        assert!(matches!(error_level, ErrorLevel::Warning));
    }
}
