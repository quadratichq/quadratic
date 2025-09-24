use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::arrow::object_store::{ObjectStore, new_s3_object_store};
use quadratic_rust_shared::sql::datafusion_connection::DatafusionConnection;
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
    pub(crate) _object_store_url: Option<Url>,
}

impl Settings {
    pub(crate) fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        let datafustion_connection = new_datafusion_connection(config).ok();
        let (object_store, object_store_url) = s3_object_store(config).ok().unzip();

        Settings {
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            jwks,
            max_response_bytes: config.max_response_bytes,
            datafusion_connection: datafustion_connection,
            object_store,
            _object_store_url: object_store_url,
        }
    }
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

fn s3_object_store(config: &Config) -> Result<(Arc<dyn ObjectStore>, Url)> {
    let is_local = config.environment.is_local_or_docker();

    new_s3_object_store(
        config.aws_s3_bucket_name.as_ref().unwrap(),
        config.aws_s3_region.as_ref().unwrap(),
        config.aws_s3_access_key_id.as_ref().unwrap(),
        config.aws_s3_secret_access_key.as_ref().unwrap(),
        is_local,
    )
    .map_err(ConnectionError::from)
}
