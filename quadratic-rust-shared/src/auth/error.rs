//! Error Handling for Auth
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::SharedError;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Auth {
    #[error("JWT error: {0}")]
    Jwt(String),
}

impl From<jsonwebtoken::errors::Error> for SharedError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        SharedError::Auth(Auth::Jwt(error.to_string()))
    }
}
