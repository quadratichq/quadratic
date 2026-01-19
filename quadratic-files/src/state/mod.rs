//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod pubsub;
pub mod settings;
pub mod stats;

use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use quadratic_rust_shared::quadratic_database::{
    ConnectionOptions, PgPool, connect, get_database_settings, warm_pool,
};
use tokio::sync::Mutex;

use crate::config::Config;
use crate::error::{FilesError, Result};
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
    pub(crate) batch_size: usize,
}

impl State {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let pubsub_config = PubSubConfig::RedisStreams(RedisStreamsConfig {
            host: config.pubsub_host.to_owned(),
            port: config.pubsub_port.to_owned(),
            password: config.pubsub_password.to_owned(),
        });

        let connection_options = ConnectionOptions::new(Some(config.max_db_connections), None);

        tracing::info!(
            "Initializing database pool, max_connections: {}, batch size: {}",
            config.max_db_connections,
            config.batch_size
        );

        let pool = connect(&config.database_url, connection_options)
            .map_err(|e| FilesError::DatabaseConnect(e.to_string()))?;

        // Pre-warm the connection pool by establishing at least one connection
        warm_pool(&pool)
            .await
            .map_err(|e| FilesError::DatabaseConnect(e.to_string()))?;

        // Log database settings to help diagnose connection issues
        match get_database_settings(&pool).await {
            Ok(settings) => {
                tracing::info!(
                    "Database connection established - pool size: {}, db max_connections: {}, db current_connections: {}",
                    pool.size(),
                    settings.max_connections,
                    settings.current_connections
                );
            }
            Err(e) => {
                tracing::warn!("Database connected but failed to query settings: {e}");
            }
        }

        Ok(State {
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            settings: Settings::new(config, jwks).await?,
            stats: Mutex::new(Stats::new()),
            synced_connection_cache: SyncedConnectionCache::new(),
            pool,
            batch_size: config.batch_size,
        })
    }
}
