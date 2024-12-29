//! Global Configuration
//!
//! Leveraging the `dotenv` crate, this module provides a global configuration
//! struct. This struct is populated by the `.env` file in the root of the
//! sub-repo.  If ANY of the environment variables are missing, the program will
//! panic at startup.

use crate::error::{MpError, Result};
use dotenv::dotenv;
use quadratic_rust_shared::environment::Environment;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    #[serde(default = "default_host")]
    pub(crate) host: String,
    #[serde(default = "default_port")]
    pub(crate) port: String,
    pub(crate) heartbeat_check_s: i64,
    pub(crate) authenticate_jwt: bool,
    pub(crate) heartbeat_timeout_s: i64,
    pub(crate) environment: Environment,

    pub(crate) pubsub_host: String,
    pub(crate) pubsub_port: String,
    pub(crate) pubsub_password: String,
    pub(crate) pubsub_active_channels: String,

    pub(crate) auth0_jwks_uri: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> String {
    "3001".to_string()
}

/// Load the global configuration from the environment into Config.
pub(crate) fn config() -> Result<Config> {
    let filename = if cfg!(test) { ".env.test" } else { ".env" };
    // let filename = if cfg!(test) { ".env" } else { ".env" };

    dotenv::from_filename(filename).ok();
    dotenv().ok();

    let mut config = envy::from_env::<Config>().map_err(|e| MpError::Config(e.to_string()))?;
    if config.host.is_empty() {
        config.host = default_host();
    }
    if config.port.is_empty() {
        config.port = default_port();
    }
    Ok(config)
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
