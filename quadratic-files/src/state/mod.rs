//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod pubsub;
pub mod settings;
pub mod stats;

use std::sync::Arc;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use quadratic_rust_shared::quadratic_database::{ConnectionOptions, PgPool, connect_lazy};
use tokio::sync::{Mutex, Semaphore};

use crate::config::Config;
use crate::error::Result;
use crate::state::settings::Settings;
use crate::synced_connection::cache::SyncedConnectionCache;

use self::pubsub::PubSub;
use self::stats::Stats;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) pubsub: Mutex<PubSub>,
    pub(crate) settings: Settings,
    pub(crate) stats: Mutex<Stats>,
    pub(crate) synced_connection_cache: SyncedConnectionCache,
    pub(crate) pool: PgPool,
    /// Limits concurrent file processing to prevent database pool exhaustion
    pub(crate) file_processing_semaphore: Arc<Semaphore>,
}

impl State {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let pubsub_config = PubSubConfig::RedisStreams(RedisStreamsConfig {
            host: config.pubsub_host.to_owned(),
            port: config.pubsub_port.to_owned(),
            password: config.pubsub_password.to_owned(),
        });

        let connection_options = ConnectionOptions::new(
            Some(config.max_db_connections),
            None, // use default acquire_timeout
        );

        tracing::info!(
            "Initializing database pool with {} max connections, {} max concurrent file processing",
            config.max_db_connections,
            config.max_concurrent_file_processing
        );

        Ok(State {
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            settings: Settings::new(config, jwks).await?,
            stats: Mutex::new(Stats::new()),
            synced_connection_cache: SyncedConnectionCache::new(),
            pool: connect_lazy(&config.database_url, connection_options)?,
            file_processing_semaphore: Arc::new(Semaphore::new(
                config.max_concurrent_file_processing,
            )),
        })
    }
}
