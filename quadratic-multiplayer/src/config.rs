//! Global Configuration
//!
//! Leveraging the `dotenv` crate, this module provides a global configuration
//! struct. This struct is populated by the `.env` file in the root of the
//! sub-repo.  If ANY of the environment variables are missing, the program will
//! panic at startup.

use anyhow::Result;
use dotenv::dotenv;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    pub(crate) host: String,
    pub(crate) port: String,
}

/// Load the global configuration from the environment into Config.
pub(crate) fn config() -> Result<Config> {
    dotenv().ok();
    Ok(envy::from_env::<Config>()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gets_a_config() {
        let host = "127.0.0.1";
        std::env::set_var("HOST", host);
        let config = config().unwrap();
        assert_eq!(config.host, host.to_string());
    }
}
