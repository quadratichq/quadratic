use anyhow::Result;
use uuid::Uuid;

use crate::config::Config;

pub(crate) struct Settings {
    pub(crate) controller_url: String,
    pub(crate) file_id: Uuid,
    pub(crate) worker_ephemeral_token: Uuid,
}

impl Settings {
    pub(crate) fn new(config: Config) -> Result<Self> {
        Ok(Self {
            controller_url: config.controller_url,
            file_id: config.file_id,
            worker_ephemeral_token: config.worker_ephemeral_token,
        })
    }
}
