//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod jwt;
mod pubsub;
mod settings;

use std::collections::{HashMap, HashSet};

use anyhow::Result;
use kube::client::Client as KubeClient;
use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::Config;

use self::pubsub::PubSub;
use self::settings::Settings;

pub(crate) struct State {
    pub(crate) settings: Settings,
    pub(crate) pubsub: Mutex<PubSub>,
    pub(crate) kube_client: KubeClient,
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

        // Configure kube client with extended timeout for local dev
        let mut kube_config = kube::Config::infer().await?;
        kube_config.connect_timeout = Some(std::time::Duration::from_secs(30));
        kube_config.read_timeout = Some(std::time::Duration::from_secs(30));
        let kube_client = KubeClient::try_from(kube_config)?;

        Ok(State {
            settings: Settings::new(config).await?,
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            kube_client,
            worker_ephemeral_tokens: Mutex::new(HashMap::new()),
            creating_workers: Mutex::new(HashSet::new()),
        })
    }

    pub(crate) async fn generate_worker_ephemeral_token(&self, file_id: &Uuid) -> Uuid {
        let token = Uuid::new_v4();
        self.worker_ephemeral_tokens
            .lock()
            .await
            .insert(*file_id, token);
        token
    }

    pub(crate) async fn verify_worker_ephemeral_token(
        &self,
        file_id: Uuid,
        worker_ephemeral_token: Uuid,
    ) -> Result<Uuid> {
        let stored_worker_ephemeral_token = self
            .worker_ephemeral_tokens
            .lock()
            .await
            .get(&file_id)
            .cloned();
        if stored_worker_ephemeral_token == Some(worker_ephemeral_token) {
            Ok(file_id)
        } else {
            Err(anyhow::anyhow!(
                "Invalid worker ephemeral token for file {file_id}"
            ))
        }
    }

    pub(crate) async fn remove_worker_ephemeral_token(&self, file_id: &Uuid) {
        self.worker_ephemeral_tokens.lock().await.remove(file_id);
    }

    pub(crate) async fn acquire_worker_create_lock(&self, file_id: &Uuid) -> bool {
        self.creating_workers.lock().await.insert(*file_id)
    }

    pub(crate) async fn release_worker_create_lock(&self, file_id: &Uuid) {
        self.creating_workers.lock().await.remove(file_id);
    }
}
