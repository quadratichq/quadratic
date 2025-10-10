//! Error Handling for Crypto
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Crypto {
    #[error("Error decoding {0}")]
    AesCbcDecode(String),

    #[error("Error encoding {0}")]
    AesCbcEncode(String),
}
