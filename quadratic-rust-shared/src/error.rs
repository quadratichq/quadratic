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
pub enum Arrow {
    #[error("Arrow error: {0}")]
    External(String),
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Auth {
    #[error("JWT error: {0}")]
    Jwt(String),
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Aws {
    #[error("Error communicating with AWS: {0}")]
    S3(String),
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Sql {
    #[error("Error connecting to database: {0}")]
    Connect(String),

    #[error("Error converting results to Parquet: {0}")]
    ParquetConversion(String),

    #[error("Error executing query: {0}")]
    Query(String),

    #[error("Error creating schema: {0}")]
    Schema(String),
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Storage {
    #[error("Error creating directory {0}: {1}")]
    CreateDirectory(String, String),

    #[error("Invalid key: {0}")]
    InvalidKey(String),

    #[error("Error reading key {0}: {1}")]
    Read(String, String),

    #[error("Error writing key {0}: {1}")]
    Write(String, String),
}

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum SharedError {
    #[error("Error with Arrow: {0}")]
    Arrow(Arrow),

    #[error("Error with auth: {0}")]
    Auth(Auth),

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

    #[error("Error with SQL connector: {0}")]
    Sql(Sql),

    #[error("Error with Storage: {0}")]
    Storage(Storage),

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

impl From<jsonwebtoken::errors::Error> for SharedError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        SharedError::Auth(Auth::Jwt(error.to_string()))
    }
}

impl From<parquet::errors::ParquetError> for SharedError {
    fn from(error: parquet::errors::ParquetError) -> Self {
        SharedError::Sql(Sql::ParquetConversion(error.to_string()))
    }
}

impl From<arrow::error::ArrowError> for SharedError {
    fn from(error: arrow::error::ArrowError) -> Self {
        SharedError::Arrow(Arrow::External(error.to_string()))
    }
}
