//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

mod client;
pub mod jwt;
mod pubsub;
mod settings;
mod worker;

use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use std::collections::{HashMap, HashSet};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;
use crate::error::Result;
use crate::state::pubsub::PubSub;
use crate::state::settings::Settings;

pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) pubsub: Mutex<PubSub>,

    #[cfg(feature = "docker")]
    pub(crate) client: Mutex<quadratic_rust_shared::docker::cluster::Cluster>,

    #[cfg(feature = "kubernetes")]
    pub(crate) client: kube::client::Client,
    pub(crate) worker_ephemeral_tokens: Mutex<HashMap<Uuid, Uuid>>,
    pub(crate) creating_workers: Mutex<HashSet<Uuid>>,
}

impl State {
    pub(crate) async fn new(config: &Config) -> Result<Self> {
        let pubsub_config = PubSubConfig::RedisStreams(RedisStreamsConfig {
            host: config.pubsub_host.to_owned(),
            port: config.pubsub_port.to_owned(),
            password: config.pubsub_password.to_owned(),
        });

        Ok(State {
            settings: Settings::new(config).await?,
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            client: Mutex::new(Self::init_client().await?),
            worker_ephemeral_tokens: Mutex::new(HashMap::new()),
            creating_workers: Mutex::new(HashSet::new()),
        })
    }
}
