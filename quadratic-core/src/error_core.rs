//! quadratic-core error handling
//!
//! Create a generic Result type to reduce boilerplate.
//! Define errors used in the application.
//! Convert third party crate errors to application errors.
//! Convert errors to responses.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, CoreError>;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub enum CoreError {
    #[error("Error serializing or deserialize: {0}")]
    Serialization(String),

    #[error("Unknown error: {0}")]
    Unknown(String),

    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),

    #[error("Unhandled language: {0}")]
    UnhandledLanguage(String),

    #[error("IndexedDb error: {0}")]
    IndexedDbError(String),
}

impl From<serde_json::Error> for CoreError {
    fn from(error: serde_json::Error) -> Self {
        CoreError::Serialization(error.to_string())
    }
}

impl From<uuid::Error> for CoreError {
    fn from(error: uuid::Error) -> Self {
        CoreError::Unknown(error.to_string())
    }
}
