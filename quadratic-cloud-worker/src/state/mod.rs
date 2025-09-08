mod settings;

use anyhow::Result;

use self::settings::Settings;

pub(crate) struct State {
    pub(crate) settings: Settings,
}

impl State {
    pub(crate) fn new() -> Result<Self> {
        let settings = Settings::new()?;

        Ok(Self { settings })
    }
}
