//! Global Configuration
//!
//! Leveraging the `dotenv` crate, this module provides a global configuration
//! struct. This struct is populated by the `.env` file in the root of the
//! sub-repo.  If ANY of the environment variables are missing, the program will
//! panic at startup.

use dotenv::dotenv;
use quadratic_rust_shared::storage::StorageType;
use quadratic_rust_shared::{environment::Environment, synced::plaid::client::PlaidEnvironment};
use serde::Deserialize;

use crate::error::{ConnectionError, Result};

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    pub(crate) host: String,
    pub(crate) port: String,
    pub(crate) environment: Environment,

    pub(crate) jwks_uri: String,
    pub(crate) quadratic_jwks: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) max_response_bytes: u64,
    pub(crate) static_ips: Vec<String>,

    // Storage Type: s3 or file-system
    pub(crate) storage_type: StorageType,

    // StorageType::S3
    pub(crate) aws_s3_region: Option<String>,
    pub(crate) aws_s3_synced_data_bucket_name: Option<String>,
    pub(crate) aws_s3_access_key_id: Option<String>,
    pub(crate) aws_s3_secret_access_key: Option<String>,

    // StorageType::FileSystem
    pub(crate) synced_data_storage_dir: Option<String>,
    pub(crate) storage_encryption_keys: Option<Vec<String>>,

    // Plaid
    pub(crate) plaid_client_id: String,
    pub(crate) plaid_secret: String,
    pub(crate) plaid_environment: PlaidEnvironment,

    // Intrinio
    pub(crate) intrinio_api_key: String,
}

/// Load the global configuration from the environment into Config.
pub(crate) fn config() -> Result<Config> {
    dotenv::from_filename(".env").ok();

    #[cfg(test)]
    dotenv::from_filename(".env.test").ok();

    dotenv().ok();

    // Try prefixed first, fall back to non-prefixed if that fails
    let config = envy::prefixed("CONNECTION__")
        .from_env::<Config>()
        .or_else(|_| envy::from_env::<Config>())
        .map_err(|e| ConnectionError::Config(e.to_string()))?;
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
