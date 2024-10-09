use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Arrow {
    #[error("Arrow error: {0}")]
    External(String),
}
