//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod settings;
pub mod transaction_queue;

use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;
use crate::error::Result;
use crate::state::settings::Settings;
use crate::state::transaction_queue::TransactionQueue;

#[derive(Debug)]
pub(crate) struct State {
    pub(crate) transaction_queue: Mutex<TransactionQueue>,
    pub(crate) settings: Settings,
}

impl State {
    pub(crate) async fn new(config: &Config) -> Self {
        let pubsub_config = PubSubConfig::RedisStreams(RedisStreamsConfig {
            host: config.pubsub_host.to_owned(),
            port: config.pubsub_port.to_owned(),
            password: config.pubsub_password.to_owned(),
        });

        State {
            transaction_queue: Mutex::new(TransactionQueue::new(pubsub_config).await),
            settings: Settings::new(config).await,
        }
    }
}
