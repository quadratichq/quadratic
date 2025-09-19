//! Error Handling for SQL
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

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
