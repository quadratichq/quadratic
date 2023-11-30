use anyhow::Result;
use dotenv::dotenv;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    pub(crate) host: String,
    pub(crate) port: String,
}

pub(crate) fn config() -> Result<Config> {
    dotenv().ok();
    Ok(envy::from_env::<Config>()?)
}
