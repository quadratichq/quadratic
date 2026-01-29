//! Error Handling for Intrinio
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::SharedError;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Intrinio {
    #[error("Error calling endpoint {0}: {1}")]
    Endpoint(String, String),
}

impl From<Intrinio> for SharedError {
    fn from(error: Intrinio) -> Self {
        SharedError::Intrinio(error)
    }
}
