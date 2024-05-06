//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod settings;
pub mod stats;

use tokio::sync::Mutex;

use crate::config::Config;
use crate::state::settings::Settings;

use self::stats::Stats;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) _settings: Settings,
    pub(crate) stats: Mutex<Stats>,
}

impl State {
    pub(crate) fn new(config: &Config) -> Self {
        State {
            _settings: Settings::new(config),
            stats: Mutex::new(Stats::new()),
        }
    }
}
