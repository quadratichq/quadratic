//! Global Configuration
//!
//! Leveraging the `dotenv` crate, this module provides a global configuration
//! struct. This struct is populated by the `.env` file in the root of the
//! sub-repo.  If ANY of the environment variables are missing, the program will
//! panic at startup.

use crate::error::{FilesError, Result};
use dotenv::dotenv;
use quadratic_rust_shared::environment::Environment;
use quadratic_rust_shared::storage::StorageType;
use quadratic_rust_shared::synced::plaid::client::PlaidEnvironment;
use serde::Deserialize;

fn default_max_db_connections() -> u32 {
    10
}

fn default_batch_size() -> usize {
    10
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    pub(crate) host: String,
    pub(crate) port: String,
    pub(crate) file_check_s: i64,
    pub(crate) files_per_check: i64,
    pub(crate) truncate_file_check_s: i64,
    pub(crate) truncate_transaction_age_days: i64,
    pub(crate) environment: Environment,

    /// Maximum number of database connections in the pool (default: 10)
    #[serde(default = "default_max_db_connections")]
    pub(crate) max_db_connections: u32,
    /// Number of files to process per batch (default: 10)
    #[serde(default = "default_batch_size")]
    pub(crate) batch_size: usize,

    pub(crate) pubsub_host: String,
    pub(crate) pubsub_port: String,
    pub(crate) pubsub_password: String,
    pub(crate) pubsub_active_channels: String,
    pub(crate) pubsub_processed_transactions_channel: String,

    pub(crate) jwks_uri: String,
    pub(crate) database_url: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,

    // Storage Type: s3 or file-system
    pub(crate) storage_type: StorageType,

    // StorageType::S3
    pub(crate) aws_s3_region: Option<String>,
    pub(crate) aws_s3_bucket_name: Option<String>,
    pub(crate) aws_s3_synced_data_bucket_name: Option<String>,
    pub(crate) aws_s3_access_key_id: Option<String>,
    pub(crate) aws_s3_secret_access_key: Option<String>,

    // StorageType::FileSystem
    pub(crate) storage_dir: Option<String>,
    pub(crate) synced_data_storage_dir: Option<String>,
    pub(crate) storage_encryption_keys: Option<Vec<String>>,

    // Plaid
    pub(crate) plaid_client_id: String,
    pub(crate) plaid_secret: String,
    pub(crate) plaid_environment: PlaidEnvironment,

    // Intrinio (for data pipeline)
    #[serde(default)]
    pub(crate) intrinio_api_key: String,
}

/// Load the global configuration from the environment into Config.
pub(crate) fn config() -> Result<Config> {
    let filename = if cfg!(test) { ".env.test" } else { ".env" };

    dotenv::from_filename(filename).ok();
    dotenv().ok();

    // Try prefixed first, fall back to non-prefixed if that fails
    let config = envy::prefixed("FILES__")
        .from_env::<Config>()
        .or_else(|_| envy::from_env::<Config>())
        .map_err(|e| FilesError::Config(e.to_string()))?;
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
