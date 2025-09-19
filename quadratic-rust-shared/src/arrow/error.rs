//! Error Handling for Arrow
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::SharedError;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Arrow {
    #[error("Error converting string to array: {0}")]
    ConvertString(String),

    #[error("Arrow error: {0}")]
    External(String),
}

impl From<arrow::error::ArrowError> for SharedError {
    fn from(error: arrow::error::ArrowError) -> Self {
        SharedError::Arrow(Arrow::External(error.to_string()))
    }
}
