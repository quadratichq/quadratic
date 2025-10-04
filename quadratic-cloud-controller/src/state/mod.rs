//! Shared State
//!
//! Store information about the state of the application in a send + sync
//! struct.  All access and mutations to state should be performed here.

pub mod jwt;
mod pubsub;
mod settings;

use quadratic_rust_shared::pubsub::Config as PubSubConfig;
use quadratic_rust_shared::pubsub::redis_streams::RedisStreamsConfig;
use std::collections::{HashMap, HashSet};
use tokio::sync::Mutex;
use uuid::Uuid;

#[cfg(feature = "kubernetes")]
use kube::client::Client as KubeClient;
#[cfg(feature = "docker")]
use quadratic_rust_shared::docker::cluster::Cluster;

use self::pubsub::PubSub;
use self::settings::Settings;
use crate::config::Config;
use crate::error::{ControllerError, Result};

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

        // Configure kube client with extended timeout for local dev

        Ok(State {
            settings: Settings::new(config).await?,
            pubsub: Mutex::new(PubSub::new(pubsub_config).await?),
            client: Mutex::new(Self::init_client().await?),
            worker_ephemeral_tokens: Mutex::new(HashMap::new()),
            creating_workers: Mutex::new(HashSet::new()),
        })
    }

    #[cfg(feature = "docker")]
    async fn init_client() -> Result<Cluster> {
        let client = Cluster::try_new()
            .await
            .map_err(|e| ControllerError::Client(e.to_string()))?;

        Ok(client)
    }

    #[cfg(feature = "kubernetes")]
    fn init_client() -> Result<KubeClient> {
        let mut kube_config = kube::Config::infer()
            .await
            .map_err(|e| ControllerError::Client(e.to_string()))?;
        kube_config.connect_timeout = Some(std::time::Duration::from_secs(30));
        kube_config.read_timeout = Some(std::time::Duration::from_secs(30));
        let client = KubeClient::try_from(kube_config)
            .map_err(|e| ControllerError::Client(e.to_string()))?;

        Ok(client)
    }

    #[cfg(feature = "kubernetes")]
    fn get_client(&self) -> &KubeClient {
        &self.client
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

        let tokens_match = stored_worker_ephemeral_token == Some(worker_ephemeral_token);

        if !tokens_match {
            return Err(ControllerError::WorkerEphemeralToken(format!(
                "Invalid worker ephemeral token for file {file_id}"
            )));
        }

        Ok(file_id)
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
