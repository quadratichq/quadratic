use jsonwebtoken::jwk::JwkSet;

use crate::config::Config;

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) jwks: Option<JwkSet>,
    pub(crate) authenticate_jwt: bool,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) version: String,
}

/// Gets the version of the crate (which should be in sync with the client version)
pub(crate) fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

impl Settings {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        Settings {
            jwks,
            authenticate_jwt: config.authenticate_jwt,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            version: version(),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::config::config;

    use super::*;

    #[test]
    fn gets_version() {
        let version = version();
        assert!(!version.is_empty());
    }

    #[tokio::test]
    async fn test_settings() {
        let config = config().unwrap();
        let settings = Settings::new(&config, None).await;
        assert_eq!(settings.version, version());
    }
}
