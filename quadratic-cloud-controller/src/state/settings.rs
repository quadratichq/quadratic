use jsonwebtoken::{EncodingKey, jwk::JwkSet};
use quadratic_rust_shared::environment::Environment;

use crate::config::Config;
use crate::error::{ControllerError, Result};

pub(crate) struct Settings {
    pub(crate) environment: Environment,
    pub(crate) public_host: String,
    pub(crate) public_port: String,
    pub(crate) worker_only_host: String,
    pub(crate) worker_only_port: String,
    pub(crate) worker_internal_host: String,
    pub(crate) multiplayer_host: String,
    pub(crate) multiplayer_port: String,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) jwt_encoding_key: EncodingKey,
    pub(crate) jwt_expiration_seconds: u64,
    pub(crate) jwks: JwkSet,
    pub(crate) worker_jwt_email: String,
    pub(crate) _namespace: String,
    pub(crate) version: String,
}

/// Gets the version of the crate (which should be in sync with the client version)
pub(crate) fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

impl Settings {
    pub(crate) async fn new(config: &Config) -> Result<Self> {
        let jwt_encoding_key =
            EncodingKey::from_rsa_pem(config.jwt_encoding_key.replace(r"\n", "\n").as_bytes())
                .map_err(|e| ControllerError::Settings(e.to_string()))?;

        let jwks: JwkSet = serde_json::from_str(&config.jwks)
            .map_err(|e| ControllerError::Settings(e.to_string()))?;

        let settings = Settings {
            environment: config.environment,
            public_host: config.public_host.to_owned(),
            public_port: config.public_port.to_owned(),
            worker_internal_host: config.worker_internal_host.to_owned(),
            worker_only_host: config.worker_only_host.to_owned(),
            worker_only_port: config.worker_only_port.to_owned(),
            multiplayer_host: config.multiplayer_host.to_owned(),
            multiplayer_port: config.multiplayer_port.to_owned(),
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            jwt_encoding_key,
            jwt_expiration_seconds: config.jwt_expiration_seconds,
            jwks,
            worker_jwt_email: config.worker_jwt_email.to_owned(),
            _namespace: config.namespace.to_owned(),
            version: version(),
        };

        Ok(settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gets_version() {
        let version = version();
        assert!(!version.is_empty());
    }

    #[tokio::test]
    async fn test_settings() {
        let config = Config::new().unwrap();
        let settings = Settings::new(&config).await.unwrap();
        assert_eq!(settings.version, version());
    }
}
