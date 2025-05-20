//! Error Handling for SQL
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::SharedError;

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

impl From<parquet::errors::ParquetError> for SharedError {
    fn from(error: parquet::errors::ParquetError) -> Self {
        SharedError::Sql(Sql::ParquetConversion(error.to_string()))
    }
}
