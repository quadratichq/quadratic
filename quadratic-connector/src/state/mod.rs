//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod settings;
pub mod stats;

use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::state::settings::Settings;

use self::stats::Stats;

#[derive(Debug, Clone)]
pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) stats: Arc<Mutex<Stats>>,
}

impl State {
    pub(crate) fn new(config: &Config, jwks: Option<JwkSet>) -> Self {
        State {
            settings: Settings::new(config, jwks),
            stats: Arc::new(Mutex::new(Stats::new())),
        }
    }
}
