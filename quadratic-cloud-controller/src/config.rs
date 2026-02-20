use anyhow::Result;
use dotenv::dotenv;
use quadratic_rust_shared::environment::Environment;
use quadratic_rust_shared::storage::StorageType;
use serde::Deserialize;

use crate::error::ControllerError;

#[derive(Deserialize, Debug, Clone)]
pub(crate) struct Config {
    pub(crate) environment: Environment,
    pub(crate) public_host: String,
    pub(crate) public_port: String,
    pub(crate) worker_only_host: String,
    pub(crate) worker_only_port: String,
    pub(crate) worker_internal_host: String,
    pub(crate) multiplayer_host: String,
    pub(crate) multiplayer_port: String,
    pub(crate) connection_host: String,
    pub(crate) connection_port: String,
    pub(crate) files_host: String,
    pub(crate) files_port: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) quadratic_jwt_encoding_key: String,
    pub(crate) quadratic_jwt_expiration_seconds: u64,
    pub(crate) worker_jwt_email: String,
    pub(crate) namespace: String,
    pub(crate) pubsub_host: String,
    pub(crate) pubsub_port: String,
    pub(crate) pubsub_password: String,

    #[serde(default = "default_start_server")]
    pub(crate) start_server: bool,

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

fn default_start_server() -> bool {
    true
}

impl Config {
    pub(crate) fn new() -> Result<Config> {
        let filename = if cfg!(test) { ".env.test" } else { ".env" };

        dotenv::from_filename(filename).ok();
        dotenv().ok();

        // Try prefixed first, fall back to non-prefixed if that fails
        let config = envy::prefixed("CLOUD_CONTROLLER__")
            .from_env::<Config>()
            .or_else(|_| envy::from_env::<Config>())
            .map_err(|e| ControllerError::Config(e.to_string()))?;

        Ok(config)
    }
}
