//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod schema_cache;
pub mod settings;
pub mod stats;

use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::intrinio::client::IntrinioClient;
use reqwest::Client;
use reqwest::redirect::Policy;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::error::{Result, proxy_error};
use crate::state::schema_cache::SchemaCache;
use crate::state::settings::Settings;

use self::stats::Stats;

#[derive(Debug, Clone)]
pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) client: Client,
    pub(crate) intrinio_client: IntrinioClient,
    pub(crate) schema_cache: SchemaCache,
    pub(crate) stats: Arc<Mutex<Stats>>,
}

impl State {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let intrinio_client = IntrinioClient::new(&config.intrinio_api_key);

        Ok(State {
            settings: Settings::new(config, jwks).await?,
            client: Client::builder()
                .cookie_store(true)
                .redirect(Policy::limited(5))
                .build()
                .map_err(proxy_error)?,
            intrinio_client,
            schema_cache: SchemaCache::new(),
            stats: Arc::new(Mutex::new(Stats::new())),
        })
    }
}
