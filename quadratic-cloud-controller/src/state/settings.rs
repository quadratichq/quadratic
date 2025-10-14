use jsonwebtoken::{EncodingKey, jwk::JwkSet};
use quadratic_rust_shared::environment::Environment;
use url::Url;

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
    pub(crate) files_host: String,
    pub(crate) files_port: String,
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
            files_host: config.files_host.to_owned(),
            files_port: config.files_port.to_owned(),
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

    // Get the scheme for the files service
    pub(crate) fn files_scheme(&self) -> String {
        if self.environment == Environment::Development
            || self.environment == Environment::Production
        {
            "https".into()
        } else {
            "http".into()
        }
    }

    // Replace the host, port, and scheme for a presigned url
    pub(crate) fn files_presigned_url(&self, url: &str) -> Result<Url> {
        let error =
            |message: &str| ControllerError::WorkerPresignedUrl(format!("{message}: {url:?}"));
        let mut url = Url::parse(&url).map_err(|e| error(&e.to_string()))?;

        // replace the scheme
        let scheme = self.files_scheme();
        url.set_scheme(&scheme)
            .map_err(|_e| error("Error setting scheme"))?;

        // replace the host
        let files_host = self.files_host.to_string();
        url.set_host(Some(&files_host))
            .map_err(|e| error(&e.to_string()))?;

        // replace the port
        let files_port = self
            .files_port
            .parse::<u16>()
            .map_err(|e| error(&e.to_string()))?;
        url.set_port(Some(files_port))
            .map_err(|_e| error("Error setting port"))?;

        Ok(url)
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
