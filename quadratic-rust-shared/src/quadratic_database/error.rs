//! Error Handling for Net
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::SharedError;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum QuadraticDatabase {
    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Error connecting to database: {0}")]
    Connect(String),

    #[error("Record not found: {0}")]
    NotFound(String),

    #[error("Error executing query: {0}")]
    Query(String),
}

impl From<sqlx::Error> for QuadraticDatabase {
    fn from(error: sqlx::Error) -> Self {
        QuadraticDatabase::Query(error.to_string())
    }
}

impl From<QuadraticDatabase> for SharedError {
    fn from(error: QuadraticDatabase) -> Self {
        SharedError::QuadraticDatabase(error)
    }
}
