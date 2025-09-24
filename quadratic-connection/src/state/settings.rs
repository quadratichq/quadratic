use std::path::PathBuf;
use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::arrow::object_store::{
    ObjectStore, new_filesystem_object_store, new_s3_object_store,
};
use quadratic_rust_shared::sql::datafusion_connection::DatafusionConnection;
use quadratic_rust_shared::storage::StorageType;
use reqwest::Url;

use crate::config::Config;
use crate::error::{ConnectionError, Result};

#[derive(Debug, Clone)]
pub(crate) struct Settings {
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) max_response_bytes: u64,
    pub(crate) datafusion_connection: Option<DatafusionConnection>,
    pub(crate) object_store: Option<Arc<dyn ObjectStore>>,
}

impl Settings {
    pub(crate) fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        let datafustion_connection = new_datafusion_connection(config).ok();
        let object_store = object_store(config).ok();

        Settings {
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            jwks,
            max_response_bytes: config.max_response_bytes,
            datafusion_connection: datafustion_connection,
            object_store,
        }
    }
}

fn required<'a>(config: &'a Config, value: Option<&'a String>) -> &'a String {
    let storage_type = config.storage_type.to_string();
    value.expect(&format!(
        "Missing required environment variables for {} storage",
        storage_type
    ))
}

pub fn new_datafusion_connection(config: &Config) -> Result<DatafusionConnection> {
    let is_local = config.environment.is_local_or_docker();
    let endpoint = is_local.then_some("http://localhost:4566".to_string());

    if let (Some(access_key_id), Some(secret_access_key), Some(region), Some(bucket_name)) = (
        config.aws_s3_access_key_id.to_owned(),
        config.aws_s3_secret_access_key.to_owned(),
        config.aws_s3_region.to_owned(),
        config.aws_s3_bucket_name.to_owned(),
    ) {
        Ok(DatafusionConnection::new(
            access_key_id,
            secret_access_key,
            endpoint,
            region,
            bucket_name,
        ))
    } else {
        Err(ConnectionError::Config(
            "Missing AWS S3 credentials".to_string(),
        ))
    }
}

fn object_store(config: &Config) -> Result<Arc<dyn ObjectStore>> {
    match config.storage_type {
        StorageType::S3 => s3_object_store(config).map(|(object_store, _)| object_store),
        StorageType::FileSystem => {
            filesystem_object_store(config).map(|(object_store, _)| object_store)
        }
    }
}

fn filesystem_object_store(config: &Config) -> Result<(Arc<dyn ObjectStore>, PathBuf)> {
    let path = required(config, config.storage_dir.as_ref());
    new_filesystem_object_store(&path).map_err(ConnectionError::from)
}

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
