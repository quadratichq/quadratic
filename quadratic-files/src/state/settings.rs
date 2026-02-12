use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::SharedError;
use quadratic_rust_shared::arrow::object_store::ObjectStore;
use quadratic_rust_shared::environment::Environment;
use quadratic_rust_shared::storage::file_system::{FileSystem, FileSystemConfig};
use quadratic_rust_shared::storage::s3::{S3, S3Config};
use quadratic_rust_shared::storage::{StorageConfig, StorageContainer, StorageType};
use quadratic_rust_shared::synced::SyncedClient;
use quadratic_rust_shared::synced::plaid::client::{PlaidClient, PlaidEnvironment};
use serde::Serialize;

use crate::config::Config;
use crate::error::{FilesError, Result};

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) environment: Environment,
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) storage: StorageContainer,
    pub(crate) pubsub_processed_transactions_channel: String,
    pub(crate) object_store: Arc<dyn ObjectStore>,
    pub(crate) checkpoint_bucket_name: String,

    // Plaid
    pub(crate) plaid_client_id: String,
    pub(crate) plaid_secret: String,
    pub(crate) plaid_environment: PlaidEnvironment,

    // Intrinio
    pub(crate) intrinio_api_key: String,
}

impl Settings {
    // Create a new Settings struct from the provided Config.
    // Panics are OK here since this is set at startup and we want to fail fast.
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let file_storage = Self::new_storage(config, true).await?;
        let synced_data_storage = Self::new_storage(config, false).await?;

        let object_store = StorageConfig::from(&synced_data_storage)
            .try_into()
            .map_err(|e: SharedError| FilesError::CreateObjectStore(e.to_string()))?;

        Ok(Settings {
            environment: config.environment.to_owned(),
            jwks,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            storage: file_storage,
            pubsub_processed_transactions_channel: config
                .pubsub_processed_transactions_channel
                .to_owned(),
            object_store,
            plaid_client_id: config.plaid_client_id.to_owned(),
            plaid_secret: config.plaid_secret.to_owned(),
            plaid_environment: config.plaid_environment.to_owned(),
            intrinio_api_key: config.intrinio_api_key.to_owned(),
            checkpoint_bucket_name: Self::checkpoint_bucket_name(config),
        })
    }

    fn storage_dir(config: &Config, is_file_storage: bool) -> String {
        if is_file_storage {
            expected(&config.storage_dir, "STORAGE_DIR")
        } else {
            expected(&config.synced_data_storage_dir, "SYNCED_DATA_STORAGE_DIR")
        }
    }

    fn bucket_name(config: &Config, is_file_storage: bool) -> String {
        if is_file_storage {
            expected(&config.aws_s3_bucket_name, "AWS_S3_BUCKET_NAME")
        } else {
            expected(
                &config.aws_s3_synced_data_bucket_name,
                "AWS_S3_SYNCED_DATA_BUCKET_NAME",
            )
        }
    }

    fn checkpoint_bucket_name(config: &Config) -> String {
        match config.storage_type {
            StorageType::S3 => Self::bucket_name(config, true),
            StorageType::FileSystem => Self::storage_dir(config, true),
        }
    }

    async fn new_storage(config: &Config, is_file_storage: bool) -> Result<StorageContainer> {
        let is_local = config.environment.is_local_or_docker();
        let bucket_name = Self::bucket_name(config, is_file_storage);
        let storage_dir = Self::storage_dir(config, is_file_storage);

        let storage = match config.storage_type {
            StorageType::S3 => StorageContainer::S3(S3::new(
                S3Config::new(
                    bucket_name,
                    expected(&config.aws_s3_region, "AWS_S3_REGION"),
                    expected(&config.aws_s3_access_key_id, "AWS_S3_ACCESS_KEY_ID"),
                    expected(&config.aws_s3_secret_access_key, "AWS_S3_SECRET_ACCESS_KEY"),
                    "Quadratic File Service",
                    is_local,
                )
                .await,
            )),
            StorageType::FileSystem => {
                StorageContainer::FileSystem(FileSystem::new(FileSystemConfig {
                    path: storage_dir,
                    encryption_keys: config
                        .storage_encryption_keys
                        .to_owned()
                        .expect("Expected STORAGE_ENCRYPTION_KEYS to have a value"),
                    presigned_url_base: format!(
                        "{}:{}/storage/presigned",
                        config.host, config.port
                    ),
                }))
            }
        };

        Ok(storage)
    }

    /// Create a PlaidClient using Settings' credentials and the access_token from the connection.
    /// We use serialization to extract the access_token since it's Plaid-specific and not on the trait.
    pub(crate) fn new_plaid_client<T: Serialize>(
        &self,
        connection: &T,
    ) -> Result<Box<dyn SyncedClient>> {
        let access_token = serde_json::to_value(connection)?
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                FilesError::SyncedConnection("Plaid connection missing access_token".to_string())
            })?
            .to_string();

        let client = PlaidClient::new(
            &self.plaid_client_id,
            &self.plaid_secret,
            self.plaid_environment,
            Some(access_token),
        );

        Ok(Box::new(client))
    }
}

fn expected(val: &Option<String>, var: &str) -> String {
    val.to_owned()
        .unwrap_or_else(|| panic!("Expected {var} to have a value"))
}
