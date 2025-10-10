mod settings;

use anyhow::Result;

use self::settings::Settings;

use crate::{config::Config, error::WorkerError};

pub(crate) struct State {
    pub(crate) settings: Settings,
    #[allow(dead_code)]
    pub(crate) worker_access_token: String,
}

impl State {
    pub(crate) fn new(config: Config, worker_access_token: String) -> Result<Self> {
        let settings = Settings::new(config).map_err(|e| WorkerError::State(e.to_string()))?;

        Ok(Self {
            settings,
            worker_access_token,
        })
    }
}
