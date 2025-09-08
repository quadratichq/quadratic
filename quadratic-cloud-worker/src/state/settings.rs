use std::env;

use anyhow::Result;
use uuid::Uuid;

pub(crate) struct Settings {
    pub(crate) controller_url: String,
    pub(crate) file_id: Uuid,
    pub(crate) worker_token: Uuid,
}

impl Settings {
    pub(crate) fn new() -> Result<Self> {
        let controller_url = env::var("CONTROLLER_URL")
            .map_err(|_| anyhow::anyhow!("CONTROLLER_URL environment variable required"))?;

        let file_id = env::var("FILE_ID")
            .map_err(|_| anyhow::anyhow!("FILE_ID environment variable required"))?
            .parse()?;

        let worker_token = env::var("WORKER_TOKEN")
            .map_err(|_| anyhow::anyhow!("WORKER_TOKEN environment variable required"))?
            .parse()?;

        Ok(Self {
            controller_url,
            file_id,
            worker_token,
        })
    }
}
