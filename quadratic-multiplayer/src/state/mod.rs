//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod connection;
pub mod pubsub;
pub mod room;
pub mod settings;
pub mod stats;
pub mod user;

use dashmap::DashMap;
use jsonwebtoken::jwk::JwkSet;
use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use std::collections::HashMap;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;
use crate::error::Result;
use crate::state::room::Room;
use crate::state::settings::Settings;

use self::connection::Connection;
use self::pubsub::PubSub;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) rooms: Mutex<DashMap<Uuid, Room>>,
    pub(crate) connections: Mutex<HashMap<Uuid, Connection>>,
    pub(crate) pubsub: Mutex<PubSub>,
    pub(crate) settings: Settings,
}

impl State {
    pub(crate) async fn new(config: &Config, jwks: Option<JwkSet>) -> Result<Self> {
        let pubsub_config = PubSubConfig::RedisStreams(RedisStreamsConfig {
            host: config.pubsub_host.to_owned(),
            port: config.pubsub_port.to_owned(),
            password: config.pubsub_password.to_owned(),
            active_channels: config.pubsub_active_channels.to_owned(),
        });

        Ok(State {
            rooms: Mutex::new(DashMap::new()),
            connections: Mutex::new(HashMap::new()),
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            settings: Settings::new(config, jwks).await,
        })
    }
}
