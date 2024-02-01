use quadratic_rust_shared::aws::{client, Client};
use quadratic_rust_shared::environment::Environment;

use crate::config::Config;

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) aws_client: Client,
    pub(crate) aws_s3_bucket_name: String,
}

impl Settings {
    pub(crate) async fn new(config: &Config) -> Self {
        let is_local = config.environment == Environment::Docker;
        Settings {
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            aws_client: client(
                &config.aws_s3_access_key_id,
                &config.aws_s3_secret_access_key,
                &config.aws_s3_region,
                "Quadratic File Service",
                is_local,
            )
            .await,
            aws_s3_bucket_name: config.aws_s3_bucket_name.to_owned(),
        }
    }
}
