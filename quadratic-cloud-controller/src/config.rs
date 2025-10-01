use anyhow::Result;
use quadratic_rust_shared::environment::Environment;
use serde::Deserialize;

use crate::error::ControllerError;

#[derive(Deserialize, Debug, Clone)]
pub(crate) struct Config {
    pub(crate) environment: Environment,
    pub(crate) public_host: String,
    pub(crate) public_port: String,
    pub(crate) worker_only_host: String,
    pub(crate) worker_only_port: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) jwt_encoding_key: String,
    pub(crate) jwt_expiration_seconds: u64,
    pub(crate) jwks: String,
    pub(crate) worker_jwt_email: String,
    pub(crate) namespace: String,
    pub(crate) pubsub_host: String,
    pub(crate) pubsub_port: String,
    pub(crate) pubsub_password: String,
}

impl Config {
    pub(crate) fn new() -> Result<Config> {
        let config =
            envy::from_env::<Config>().map_err(|e| ControllerError::Config(e.to_string()))?;

        Ok(config)
    }
}
