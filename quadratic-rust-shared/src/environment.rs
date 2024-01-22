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
