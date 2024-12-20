use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Storage {
    #[error("Error creating directory {0}: {1}")]
    CreateDirectory(String, String),

    #[error("Invalid key: {0}")]
    InvalidKey(String),

    #[error("Error reading key {0}: {1}")]
    Read(String, String),

    #[error("Error writing key {0}: {1}")]
    Write(String, String),
}
