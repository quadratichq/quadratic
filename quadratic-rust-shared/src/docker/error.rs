//! Error Handling for Docker
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Docker {
    #[error("Cluser error: {0}")]
    Cluster(String),

    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Container error: {0}")]
    Container(String),
}
