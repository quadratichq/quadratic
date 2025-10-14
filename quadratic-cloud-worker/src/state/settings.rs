use uuid::Uuid;

use crate::config::Config;

pub(crate) struct Settings {
    pub(crate) controller_url: String,
    pub(crate) file_id: Uuid,
}

impl Settings {
    pub(crate) fn new(config: Config) -> Self {
        Self {
            controller_url: config.controller_url,
            file_id: config.file_id,
        }
    }
}
