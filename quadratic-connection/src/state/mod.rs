//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod schema_cache;
pub mod settings;
pub mod stats;
pub mod synced_connection_cache;

use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use reqwest::Client;
use reqwest::redirect::Policy;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::error::{Result, proxy_error};
use crate::state::schema_cache::SchemaCache;
use crate::state::settings::Settings;
use crate::state::synced_connection_cache::SyncedConnectionCache;

use self::stats::Stats;

#[derive(Debug, Clone)]
pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) client: Client,
    pub(crate) schema_cache: SchemaCache,
    pub(crate) synced_connection_cache: SyncedConnectionCache,
    pub(crate) stats: Arc<Mutex<Stats>>,
}

impl State {
    pub(crate) fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        Ok(State {
            settings: Settings::new(config, jwks)?,
            client: Client::builder()
                .cookie_store(true)
                .redirect(Policy::limited(5))
                .build()
                .map_err(proxy_error)?,
            schema_cache: SchemaCache::new(),
            synced_connection_cache: SyncedConnectionCache::new(),
            stats: Arc::new(Mutex::new(Stats::new())),
        })
    }
}
