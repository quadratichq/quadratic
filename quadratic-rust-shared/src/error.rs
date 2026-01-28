//! Error Handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.
//! Convert errors to responses.

use std::sync::PoisonError;

use serde::{Deserialize, Serialize};
use strum_macros::{Display, EnumString};
use thiserror::Error;

pub type Result<T, E = SharedError> = std::result::Result<T, E>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum SharedError {
    #[cfg(any(feature = "arrow", feature = "parquet"))]
    #[error("Error with Arrow: {0}")]
    Arrow(crate::arrow::error::Arrow),

    #[cfg(feature = "auth")]
    #[error("Error with auth: {0}")]
    Auth(crate::auth::error::Auth),

    #[cfg(feature = "aws")]
    #[error("Error communicating with AWS: {0}")]
    Aws(crate::aws::error::Aws),

    #[cfg(feature = "crypto")]
    #[error("Error with Crypto: {0}")]
    Crypto(crate::crypto::error::Crypto),

    #[cfg(feature = "quadratic-database")]
    #[error("Error with Quadratic Database: {0}")]
    QuadraticDatabase(crate::quadratic_database::error::QuadraticDatabase),

    #[cfg(feature = "docker")]
    #[error("Error with Docker: {0}")]
    Docker(crate::docker::error::Docker),

    #[error("{0}")]
    Generic(String),

    #[cfg(feature = "intrinio")]
    #[error("Error with Intrinio: {0}")]
    Intrinio(crate::intrinio::error::Intrinio),

    #[cfg(feature = "net")]
    #[error("Error with Net: {0}")]
    Net(crate::net::error::Net),

    #[error("Error communicating with the Quadratic API: {0}")]
    QuadraticApi(String),

    #[error("Error communicating with the Quadratic Cloud Controller: {0}")]
    QuadraticCloudController(String),

    #[error("Error with Protobuf: {0}")]
    Protobuf(String),
    #[cfg(feature = "parquet")]
    #[error("Error with Parquet: {0}")]
    Parquet(crate::parquet::error::Parquet),

    #[error("Error with Pubsub: {0}")]
    PubSub(String),

    #[error("Error with Reqwest: {0}")]
    Request(String),

    #[error("Error serializing or deserializing: {0}")]
    Serialization(String),

    #[cfg(feature = "sql")]
    #[error("Error with SQL connector: {0}")]
    Sql(crate::sql::error::Sql),

    #[cfg(feature = "storage")]
    #[error("Error with Storage: {0}")]
    Storage(crate::storage::error::Storage),

    #[cfg(feature = "synced")]
    #[error("Error with Synced: {0}")]
    Synced(String),

    #[error("Error with Uuid: {0}")]
    Uuid(String),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Display, EnumString)]
pub enum ErrorLevel {
    Error,
    Warning,
    Info,
}

impl ErrorLevel {
    pub fn log(&self, msg: &str) {
        match self {
            ErrorLevel::Error => tracing::error!("{}", msg),
            ErrorLevel::Warning => tracing::warn!("{}", msg),
            ErrorLevel::Info => tracing::info!("{}", msg),
        }
    }
}

pub fn clean_errors(error: impl ToString) -> String {
    let mut cleaned = error.to_string();
    let remove = vec!["error returned from database: "];

    for r in remove {
        cleaned = format!("{cleaned:?}").replace(r, "");
    }

    cleaned
}

#[cfg(any(feature = "auth", feature = "quadratic-api"))]
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

#[cfg(feature = "storage")]
impl From<crate::storage::error::Storage> for SharedError {
    fn from(error: crate::storage::error::Storage) -> Self {
        SharedError::Storage(error)
    }
}

#[cfg(feature = "parquet")]
impl From<parquet::errors::ParquetError> for SharedError {
    fn from(error: parquet::errors::ParquetError) -> Self {
        SharedError::Parquet(crate::parquet::error::Parquet::Unknown(error.to_string()))
    }
}

#[cfg(feature = "parquet")]
impl From<crate::parquet::error::Parquet> for SharedError {
    fn from(error: crate::parquet::error::Parquet) -> Self {
        SharedError::Parquet(error)
    }
}

impl From<std::io::Error> for SharedError {
    fn from(error: std::io::Error) -> Self {
        SharedError::Generic(format!("IO error: {}", error))
    }
}

impl<T> From<PoisonError<T>> for SharedError {
    fn from(error: PoisonError<T>) -> Self {
        SharedError::Generic(format!("Poison error: {}", error))
    }
}
