use aws_sdk_s3::Client;
use jsonwebtoken::jwk::JwkSet;

use crate::{config::Config, file::new_client};

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) authenticate_jwt: bool,
    pub(crate) quadratic_api_uri: String,
    pub(crate) aws_client: Client,
}

impl Settings {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        Settings {
            jwks,
            authenticate_jwt: config.authenticate_jwt,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            aws_client: new_client(
                &config.aws_s3_access_key_id,
                &config.aws_s3_secret_access_key,
                &config.aws_s3_region,
            )
            .await,
        }
    }
}
