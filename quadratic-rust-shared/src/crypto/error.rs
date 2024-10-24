use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize, Deserialize, PartialEq, Clone)]
pub enum Crypto {
    #[error("Error decoding {0}")]
    AesCbcDecode(String),
}
