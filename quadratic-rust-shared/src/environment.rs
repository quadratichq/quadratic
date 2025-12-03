//! Shared functions related to the environment

use serde::Deserialize;
use strum_macros::Display;

#[derive(Display, Deserialize, Debug, PartialEq, Clone)]
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

    pub fn is_local_or_docker(&self) -> bool {
        self == &Environment::Local || self == &Environment::Docker
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment_is_production() {
        assert!(Environment::Production.is_production());
        assert!(Environment::Development.is_development());
        assert!(Environment::Local.is_local());
        assert!(Environment::Docker.is_docker());
        assert!(Environment::Test.is_test());
    }
}
