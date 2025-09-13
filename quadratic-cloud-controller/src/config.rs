use anyhow::Result;
use dotenv::dotenv;
use quadratic_rust_shared::environment::Environment;
use serde::Deserialize;

use crate::error::ControllerError;

#[derive(Deserialize, Debug, Clone)]
pub(crate) struct Config {
    pub(crate) environment: Environment,
    pub(crate) host: String,
    pub(crate) port: String,
    pub(crate) heartbeat_check_s: u64,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) namespace: String,
    pub(crate) pubsub_host: String,
    pub(crate) pubsub_port: String,
    pub(crate) pubsub_password: String,
}

impl Config {
    pub(crate) fn new() -> Result<Config> {
        let filename = if cfg!(test) { ".env.test" } else { ".env" };

        dotenv::from_filename(filename).ok();
        dotenv().ok();

        let config =
            envy::from_env::<Config>().map_err(|e| ControllerError::Config(e.to_string()))?;

        Ok(config)
    }
}
