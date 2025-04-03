//! API for the web client

use serde::{Deserialize, Serialize};
use strum::Display;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Display)]
#[serde(rename_all = "lowercase")]
pub enum ErrorLevel {
    Error,
    Warning,
    Success,
}

pub fn message(_message: String, _error: ErrorLevel) {
    #[cfg(any(target_family = "wasm", test))]
    crate::wasm_bindings::js::jsClientMessage(_message, _error.to_string());
}
