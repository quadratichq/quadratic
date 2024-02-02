//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod pubsub;
pub mod settings;
pub mod stats;

use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::error::Result;
use crate::state::settings::Settings;

use self::pubsub::PubSub;
use self::stats::Stats;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) pubsub: Mutex<PubSub>,
    pub(crate) settings: Settings,
    pub(crate) stats: Mutex<Stats>,
}

impl State {
    pub(crate) async fn new(config: &Config) -> Result<Self> {
        let pubsub_config = PubSubConfig::RedisStreams(RedisStreamsConfig {
            host: config.pubsub_host.to_owned(),
            port: config.pubsub_port.to_owned(),
            password: config.pubsub_password.to_owned(),
            active_channels: config.pubsub_active_channels.to_owned(),
        });

        Ok(State {
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            settings: Settings::new(config).await,
            stats: Mutex::new(Stats::new()),
        })
    }
}
