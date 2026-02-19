//! Error Handling for Parquet
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Parquet {
    #[error("Error with Csv: {0}")]
    Csv(String),

    #[error("Error with Json: {0}")]
    Json(String),

    #[error("Error converting results to Parquet: {0}")]
    ParquetConversion(String),

    #[error("Error executing query: {0}")]
    Query(String),

    #[error("Error creating schema: {0}")]
    Schema(String),

    #[error("Unknown error: {0}")]
    Unknown(String),

    #[error("Error converting vec to parquet: {0}")]
    VecToParquet(String),

    #[error("Error writing record batch: {0}")]
    WriteRecordBatch(String),
}
