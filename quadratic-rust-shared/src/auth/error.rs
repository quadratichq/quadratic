//! Error Handling for Auth
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Auth {
    #[error("JWT error: {0}")]
    Jwt(String),
}
