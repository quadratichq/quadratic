//! Error Handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.
//! Convert errors to responses.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, SharedError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Aws {
    #[error("Error communicating with AWS: {0}")]
    S3(String),
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum SharedError {
    #[error("Error communicating with AWS: {0}")]
    Aws(Aws),

    #[error("Error communicating with the Quadratic API: {0}")]
    QuadraticApi(String),

    #[error("Error with Pubsub: {0}")]
    PubSub(String),

    #[error("Error with Reqwest: {0}")]
    Request(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[error("Error with Uuid: {0}")]
    Uuid(String),
}

impl From<redis::RedisError> for SharedError {
    fn from(error: redis::RedisError) -> Self {
        SharedError::PubSub(error.to_string())
    }
}

impl From<reqwest::Error> for SharedError {
    fn from(error: reqwest::Error) -> Self {
        SharedError::Request(error.to_string())
    }
}

impl From<serde_json::Error> for SharedError {
    fn from(error: serde_json::Error) -> Self {
        SharedError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for SharedError {
    fn from(error: uuid::Error) -> Self {
        SharedError::Uuid(error.to_string())
    }
}
