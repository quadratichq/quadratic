use jsonwebtoken::jwk::JwkSet;
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::error::{MpError, Result};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MinVersion {
    pub required_version: u32,
    pub recommended_version: u32,
}

impl MinVersion {
    pub fn new() -> Result<Self> {
        let file = include_str!("../../../updateAlertVersion.json");
        serde_json::from_str(file).map_err(|e| MpError::MinVersion(e.to_string()))
    }
}

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) authenticate_jwt: bool,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) min_version: MinVersion,
}

impl Settings {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        Settings {
            jwks,
            authenticate_jwt: config.authenticate_jwt,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            min_version: MinVersion::new().expect("Unable to load min version file"),
        }
    }
}
