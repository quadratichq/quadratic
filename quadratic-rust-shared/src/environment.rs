//! Shared functions related to the environment

use serde::Deserialize;
use strum_macros::Display;

#[derive(Display, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Local,
    Docker,
    Test,
    Development,
    Production,
}

impl Environment {
    pub fn is_local(&self) -> bool {
        self == &Environment::Local
    }

    pub fn is_production(&self) -> bool {
        self == &Environment::Production
    }

    pub fn is_development(&self) -> bool {
        self == &Environment::Development
    }

    pub fn is_docker(&self) -> bool {
        self == &Environment::Docker
    }

    pub fn is_test(&self) -> bool {
        self == &Environment::Test
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment_is_production() {
        assert_eq!(Environment::Production.is_production(), true);
        assert_eq!(Environment::Development.is_development(), true);
        assert_eq!(Environment::Local.is_local(), true);
        assert_eq!(Environment::Docker.is_docker(), true);
        assert_eq!(Environment::Test.is_test(), true);
    }
}
