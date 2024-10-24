use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Aws {
    #[error("Error communicating with AWS: {0}")]
    S3(String),
}
