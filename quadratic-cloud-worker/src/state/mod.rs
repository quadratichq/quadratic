mod settings;

use self::settings::Settings;

use crate::config::Config;

pub(crate) struct State {
    pub(crate) settings: Settings,
}

impl State {
    pub(crate) fn new(config: Config) -> Self {
        let settings = Settings::new(config);

        Self { settings }
    }
}
