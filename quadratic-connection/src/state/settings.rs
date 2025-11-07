use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::SharedError;
use quadratic_rust_shared::arrow::object_store::{ObjectStore, ObjectStoreKind, object_store_url};
use quadratic_rust_shared::sql::datafusion_connection::DatafusionConnection;
use quadratic_rust_shared::storage::file_system::{FileSystem, FileSystemConfig};
use quadratic_rust_shared::storage::s3::{S3, S3Config};
use quadratic_rust_shared::storage::{StorageConfig, StorageContainer, StorageType};
use std::sync::Arc;

use crate::config::Config;
use crate::error::{ConnectionError, Result};

#[derive(Debug, Clone)]
pub(crate) struct Settings {
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) max_response_bytes: u64,
    pub(crate) datafusion_connection: DatafusionConnection,
}

impl Settings {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let expected = |val: &Option<String>, var: &str| {
            val.to_owned()
                .unwrap_or_else(|| panic!("Expected {var} to have a value"))
        };
        let is_local = config.environment.is_local_or_docker();
        let storage = match config.storage_type {
            StorageType::S3 => StorageContainer::S3(S3::new(
                S3Config::new(
                    expected(
                        &config.aws_s3_synced_data_bucket_name,
                        "AWS_S3_SYNCED_DATA_BUCKET_NAME",
                    ),
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
                    path: expected(&config.storage_dir, "STORAGE_DIR"),
                    encryption_keys: config
                        .storage_encryption_keys
                        .to_owned()
                        .expect("Expected STORAGE_ENCRYPTION_KEYS to have a value"),
                }))
            }
        };

        let object_store = StorageConfig::from(&storage)
            .try_into()
            .map_err(|e: SharedError| ConnectionError::CreateObjectStore(e.to_string()))?;

        let datafusion_connection = new_datafusion_connection(config, object_store)?;

        Ok(Settings {
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            jwks,
            max_response_bytes: config.max_response_bytes,
            datafusion_connection,
        })
    }
}

/// Create a new datafusion connection.
pub fn new_datafusion_connection(
    config: &Config,
    object_store: Arc<dyn ObjectStore>,
) -> Result<DatafusionConnection> {
    let kind = match config.storage_type {
        StorageType::S3 => ObjectStoreKind::S3,
        StorageType::FileSystem => ObjectStoreKind::FileSystem,
    };
    let object_store_url =
        object_store_url(kind, config.aws_s3_synced_data_bucket_name.as_deref())?;

    Ok(DatafusionConnection::new(object_store, object_store_url))
}
