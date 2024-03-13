//! Required and recommended version of the app
//!
//! This struct is sent to the client when they first connect or reconnect to
//! the MP server.

use serde::{Deserialize, Serialize};

const FILE_MIN_VERSION: &str = "../updateAlertVersion.json";

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MinVersion {
    pub required_version: u32,
    pub recommended_version: u32,
}

impl MinVersion {
    pub fn load() -> Self {
        let file = std::fs::read_to_string(FILE_MIN_VERSION)
            .expect("Unable to read ../updateAlertVersion.json");
        serde_json::from_str(&file).expect("Unable to parse JSON")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_min_version() {
        MinVersion::load();
    }
}
