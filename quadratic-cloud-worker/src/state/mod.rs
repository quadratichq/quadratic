mod settings;

use anyhow::Result;
use uuid::Uuid;

use self::settings::Settings;

use crate::{config::Config, error::WorkerError};

pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) worker_access_token: String,
    pub(crate) team_id: Uuid,
}

impl State {
    pub(crate) fn new(config: Config, worker_access_token: String, team_id: Uuid) -> Result<Self> {
        let settings = Settings::new(config).map_err(|e| WorkerError::State(e.to_string()))?;

        Ok(Self {
            settings,
            worker_access_token,
            team_id,
        })
    }
}
