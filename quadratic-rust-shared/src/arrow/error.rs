//! Error Handling for Arrow
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Arrow {
    #[error("Arrow error: {0}")]
    External(String),
}
