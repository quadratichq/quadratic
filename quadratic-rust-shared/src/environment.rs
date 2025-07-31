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
}
