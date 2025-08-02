//! Error Handling for Net
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Net {
    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("SSH tunnel error: {0}")]
    SshTunnel(String),

    #[error("Websocket error: {0}")]
    Websocket(String),
}
