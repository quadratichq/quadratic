use quadratic_rust_shared::{
    quadratic_api::TaskRun,
    quadratic_cloud::{GetWorkerInitDataResponse, decompress_and_decode_tasks},
};
use serde::{Deserialize, Deserializer};
use uuid::Uuid;

use crate::error::{Result, WorkerError};

// Remove surrounding quotes if present (from {:?} debug format)
fn remove_surrounding_quotes<'de, D>(deserializer: D) -> std::result::Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;

    Ok(s.trim_matches('"').into())
}

/// Deserialize tasks
fn deserialize_tasks<'de, D>(
    deserializer: D,
) -> std::result::Result<Vec<(String, TaskRun)>, D::Error>
where
    D: Deserializer<'de>,
{
    let deserialized = remove_surrounding_quotes(deserializer)?;
    decompress_and_decode_tasks(deserialized).map_err(serde::de::Error::custom)
}

/// Deserialize worker init data
fn deserialize_worker_init_data<'de, D>(
    deserializer: D,
) -> std::result::Result<GetWorkerInitDataResponse, D::Error>
where
    D: Deserializer<'de>,
{
    let deserialized = remove_surrounding_quotes(deserializer)?;
    serde_json::from_str(&deserialized).map_err(serde::de::Error::custom)
}

#[derive(Deserialize, Debug)]
pub(crate) struct Config {
    pub(crate) container_id: Uuid,
    pub(crate) controller_url: String,
    pub(crate) multiplayer_url: String,
    pub(crate) connection_url: String,
    pub(crate) file_id: Uuid,
    pub(crate) jwt: String,

    #[serde(deserialize_with = "deserialize_tasks")]
    pub(crate) tasks: Vec<(String, TaskRun)>,
    #[serde(deserialize_with = "deserialize_worker_init_data")]
    pub(crate) worker_init_data: GetWorkerInitDataResponse,

    // Thumbnail rendering configuration
    pub(crate) thumbnail_fonts_dir: Option<String>,
    pub(crate) thumbnail_icons_dir: Option<String>,
    pub(crate) thumbnail_emojis_dir: Option<String>,
}

impl Config {
    pub(crate) fn new() -> Result<Config> {
        let config = envy::from_env::<Config>().map_err(|e| WorkerError::Config(e.to_string()))?;

        // Delete environment variables immediately after reading
        unsafe {
            std::env::remove_var("CONTAINER_ID");
            std::env::remove_var("CONTROLLER_URL");
            std::env::remove_var("MULTIPLAYER_URL");
            std::env::remove_var("CONNECTION_URL");
            std::env::remove_var("FILE_ID");
            std::env::remove_var("JWT");
            std::env::remove_var("TASKS");
            std::env::remove_var("WORKER_INIT_DATA");
        }

        Ok(config)
    }
}
