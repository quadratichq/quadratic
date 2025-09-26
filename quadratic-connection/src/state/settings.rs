use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::arrow::object_store::{
    ObjectStore, ObjectStoreKind, new_filesystem_object_store, new_s3_object_store,
    object_store_url,
};
use quadratic_rust_shared::sql::datafusion_connection::DatafusionConnection;
use quadratic_rust_shared::storage::StorageType;
use reqwest::Url;
use std::path::PathBuf;
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
    pub(crate) object_store: Arc<dyn ObjectStore>,
}

impl Settings {
    pub(crate) fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let object_store = object_store(config)?;
        let datafusion_connection = new_datafusion_connection(config, object_store.clone())?;

        Ok(Settings {
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            jwks,
            max_response_bytes: config.max_response_bytes,
            datafusion_connection,
            object_store,
        })
    }
}

/// Get a required value from the config.
fn required<'a>(config: &'a Config, value: Option<&'a String>) -> &'a String {
    let storage_type = config.storage_type.to_string();
    value.unwrap_or_else(|| panic!("Missing required environment variables for {} storage",
        storage_type))
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
    let object_store_url = object_store_url(kind, config.aws_s3_bucket_name.as_deref())?;

    Ok(DatafusionConnection::new(object_store, object_store_url))
}

/// Create a new object store.
fn object_store(config: &Config) -> Result<Arc<dyn ObjectStore>> {
    match config.storage_type {
        StorageType::S3 => s3_object_store(config).map(|(object_store, _)| object_store),
        StorageType::FileSystem => {
            filesystem_object_store(config).map(|(object_store, _)| object_store)
        }
    }
}

/// Create a new filesystem object store.
fn filesystem_object_store(config: &Config) -> Result<(Arc<dyn ObjectStore>, PathBuf)> {
    let path = required(config, config.storage_dir.as_ref());
    new_filesystem_object_store(path).map_err(ConnectionError::from)
}

/// Create a new S3 object store.
fn s3_object_store(config: &Config) -> Result<(Arc<dyn ObjectStore>, Url)> {
    let is_local = config.environment.is_local_or_docker();
    let bucket_name = required(config, config.aws_s3_bucket_name.as_ref());
    let region = required(config, config.aws_s3_region.as_ref());
    let access_key_id = required(config, config.aws_s3_access_key_id.as_ref());
    let secret_access_key = required(config, config.aws_s3_secret_access_key.as_ref());

    new_s3_object_store(
        bucket_name,
        region,
        access_key_id,
        secret_access_key,
        is_local,
    )
    .map_err(ConnectionError::from)
}
