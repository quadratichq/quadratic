use jsonwebtoken::jwk::JwkSet;

use crate::config::Config;

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) authenticate_jwt: bool,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
}

impl Settings {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        Settings {
            jwks,
            authenticate_jwt: config.authenticate_jwt,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
        }
    }
}
