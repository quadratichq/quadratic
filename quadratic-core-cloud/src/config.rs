//! Global Configuration
//!
//! Leveraging the `dotenv` crate, this module provides a global configuration
//! struct. This struct is populated by the `.env` file in the root of the
//! sub-repo.  If ANY of the environment variables are missing, the program will
//! panic at startup.

use crate::error::{CoreCloudError, Result};
use dotenv::dotenv;
use quadratic_rust_shared::environment::Environment;
use serde::Deserialize;
use strum_macros::Display;

#[derive(Deserialize, Debug, Display)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum StorageType {
    S3,
    FileSystem,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    pub(crate) host: String,
    pub(crate) port: String,
    pub(crate) pubsub_check_s: i64,
    pub(crate) environment: Environment,

    pub(crate) pubsub_host: String,
    pub(crate) pubsub_port: String,
    pub(crate) pubsub_password: String,
    pub(crate) pubsub_scheduled_tasks: String,

    pub(crate) auth0_jwks_uri: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,

    // Storage Type: s3 or file-system
    pub(crate) storage_type: StorageType,

    // StorageType::S3
    pub(crate) aws_s3_region: Option<String>,
    pub(crate) aws_s3_bucket_name: Option<String>,
    pub(crate) aws_s3_access_key_id: Option<String>,
    pub(crate) aws_s3_secret_access_key: Option<String>,

    // StorageType::FileSystem
    pub(crate) storage_dir: Option<String>,
    pub(crate) storage_encryption_keys: Option<Vec<String>>,
}

/// Load the global configuration from the environment into Config.
pub(crate) fn config() -> Result<Config> {
    let filename = if cfg!(test) { ".env.test" } else { ".env" };

    config_with_file(filename)
}

pub(crate) fn config_with_file(filename: &str) -> Result<Config> {
    dotenv::from_filename(filename).ok();
    dotenv().ok();

    // Try prefixed first, fall back to non-prefixed if that fails
    let config = envy::prefixed("FILES__")
        .from_env::<Config>()
        .or_else(|_| envy::from_env::<Config>())
        .map_err(|e| CoreCloudError::Config(e.to_string()))?;
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gets_a_config() {
        let host = "127.0.0.1";
        // TODO: Audit that the environment access only happens in single-threaded code.
        unsafe { std::env::set_var("HOST", host) };
        let config = config().unwrap();
        assert_eq!(config.host, host.to_string());
    }
}
