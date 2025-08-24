//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod settings;
pub mod stats;

use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::cache::{Cache as CacheTrait, memory::MemoryCache};
use reqwest::Client;
use reqwest::redirect::Policy;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;
use crate::error::{Result, proxy_error};
use crate::server::CACHE_DURATION_S;
use crate::sql::Schema;
use crate::state::settings::Settings;

use self::stats::Stats;

#[derive(Debug, Clone)]
pub(crate) struct Cache {
    pub(crate) schema: Arc<Mutex<MemoryCache<Uuid, Schema>>>,
}

impl Cache {
    /// Create a new cache
    pub(crate) fn new() -> Self {
        Self {
            schema: Arc::new(Mutex::new(MemoryCache::new())),
        }
    }

    /// Get a schema from the cache.
    /// If the schema is not found or expired, None is returned.
    pub(crate) async fn get_schema(&self, uuid: Uuid) -> Option<Schema> {
        (*self.schema.lock().await).get(&uuid).await.cloned()
    }

    /// Add a schema to the cache
    pub(crate) async fn add_schema(&self, uuid: Uuid, schema: Schema) {
        (*self.schema.lock().await)
            .create(&uuid, schema, Some(CACHE_DURATION_S))
            .await;
    }

    /// Remove a schema from the cache
    pub(crate) async fn delete_schema(&self, uuid: Uuid) -> Option<Schema> {
        (*self.schema.lock().await).delete(&uuid).await
    }
}

#[derive(Debug, Clone)]
pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) client: Client,
    pub(crate) cache: Cache,
    pub(crate) stats: Arc<Mutex<Stats>>,
}

impl State {
    pub(crate) fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        Ok(State {
            settings: Settings::new(config, jwks),
            client: Client::builder()
                .cookie_store(true)
                .redirect(Policy::limited(5))
                .build()
                .map_err(proxy_error)?,
            cache: Cache::new(),
            stats: Arc::new(Mutex::new(Stats::new())),
        })
    }
}
