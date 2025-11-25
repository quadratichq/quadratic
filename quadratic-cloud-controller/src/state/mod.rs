//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

mod client;
mod pubsub;
mod settings;

use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::error::Result;
use crate::state::pubsub::PubSub;
use crate::state::settings::Settings;

pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) pubsub: Mutex<PubSub>,

    #[cfg(feature = "docker")]
    pub(crate) client: Mutex<quadratic_rust_shared::docker::cluster::Cluster>,
    // #[cfg(feature = "kubernetes")]
    // pub(crate) client: kube::client::Client,
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
            #[cfg(feature = "docker")]
            client: Mutex::new(Self::init_client(&config.namespace).await?),
        })
    }
}
