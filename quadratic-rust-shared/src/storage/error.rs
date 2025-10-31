//! Error Handling for Storage
//!
//! Define errors used in the module.
//! Convert third party crate errors to application errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Storage {
    #[error("Error creating object store: {0}")]
    CreateObjectStore(String),

    #[error("Error creating directory {0}: {1}")]
    CreateDirectory(String, String),

    #[error("FileSystem key: {0}")]
    FileSystemKey(String),

    #[error("Error generating presigned URL for key {0}: {1}")]
    GeneratePresignedUrl(String, String),

    #[error("Invalid key: {0}")]
    InvalidKey(String),

    #[error("Error reading key {0}: {1}")]
    Read(String, String),

    #[error("Error writing key {0}: {1}")]
    Write(String, String),
}
