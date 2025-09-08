use quadratic_rust_shared::environment::Environment;

use crate::config::Config;

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) environment: Environment,
    pub(crate) host: String,
    pub(crate) port: String,
    pub(crate) heartbeat_check_s: u64,
    pub(crate) quadratic_api_uri: String,
    pub(crate) m2m_auth_token: String,
    pub(crate) namespace: String,
    pub(crate) version: String,
}

/// Gets the version of the crate (which should be in sync with the client version)
pub(crate) fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

impl Settings {
    pub(crate) async fn new(config: &Config) -> Self {
        Settings {
            environment: config.environment.clone(),
            host: config.host.to_owned(),
            port: config.port.to_owned(),
            heartbeat_check_s: config.heartbeat_check_s,
            quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            m2m_auth_token: config.m2m_auth_token.to_owned(),
            namespace: config.namespace.to_owned(),
            version: version(),
        }
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
        let settings = Settings::new(&config).await;
        assert_eq!(settings.version, version());
    }
}
