use crate::config::Config;

#[derive(Debug)]
pub(crate) struct Settings {
    pub(crate) _quadratic_api_uri: String,
    pub(crate) _m2m_auth_token: String,
}

impl Settings {
    pub(crate) fn new(config: &Config) -> Self {
        Settings {
            _quadratic_api_uri: config.quadratic_api_uri.to_owned(),
            _m2m_auth_token: config.m2m_auth_token.to_owned(),
        }
    }
}
