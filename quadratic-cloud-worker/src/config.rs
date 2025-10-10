use anyhow::Result;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::WorkerError;

#[derive(Deserialize, Debug, Clone)]
pub(crate) struct Config {
    pub(crate) controller_url: String,
    pub(crate) multiplayer_url: String,
    pub(crate) file_id: Uuid,
    pub(crate) worker_ephemeral_token: Uuid,
}

impl Config {
    pub(crate) fn new() -> Result<Config> {
        let config = envy::from_env::<Config>().map_err(|e| WorkerError::Config(e.to_string()))?;

        // Delete environment variables immediately after reading
        unsafe {
            std::env::remove_var("CONTROLLER_URL");
            std::env::remove_var("MULTIPLAYER_URL");
            std::env::remove_var("FILE_ID");
            std::env::remove_var("WORKER_EPHEMERAL_TOKEN");
        }

        Ok(config)
    }
}
