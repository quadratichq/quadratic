use quadratic_rust_shared::{
    pubsub::{Config as PubSubConfig, PubSub as PubSubTrait, redis_streams::RedisConnection},
    quadratic_api::TaskRun,
};
use std::collections::HashSet;
use tracing::{error, info, trace};
use uuid::Uuid;

use super::State;
use crate::error::{ControllerError, Result};

static GROUP: &str = "quadratic-cloud";
static CONSUMER: &str = "quadratic-cloud-scheduled-tasks-consumer";
static ACTIVE_CHANNELS: &str = "scheduled-tasks-active-channels";
static SCHEDULED_TASKS_CHANNEL: &str = "scheduled-tasks";

pub(crate) struct PubSub {
    config: PubSubConfig,
    connection: RedisConnection,
}

impl PubSub {
    /// Create a new connection to the PubSub server
    pub(crate) async fn new(config: PubSubConfig) -> Result<Self> {
        let connection = Self::connect(&config).await?;

        Ok(PubSub { config, connection })
    }

    /// Connect to the PubSub server
    async fn connect(config: &PubSubConfig) -> Result<RedisConnection> {
        let connection = RedisConnection::new(config.to_owned())
            .await
            .map_err(|e| ControllerError::PubSub(e.to_string()))?;

        Ok(connection)
    }

    /// Check if the redis connection is healthy
    async fn is_healthy(&mut self) -> bool {
        self.connection.is_healthy().await
    }

    /// Check if the connection is healthy and attempt to reconnect if not
    async fn reconnect_if_unhealthy(&mut self) {
        let is_healthy = self.is_healthy().await;

        if !is_healthy {
            error!("PubSub connection is unhealthy");

            match Self::connect(&self.config).await {
                Ok(connection) => {
                    self.connection = connection;
                    info!("PubSub connection is now healthy");
                }
                Err(error) => {
                    error!("Error reconnecting to PubSub {error}");
                }
            }
        }
    }

    /// Convert messages to tasks
    fn messages_to_tasks(messages: Vec<(String, Vec<u8>)>) -> Vec<(String, TaskRun)> {
        messages
            .into_iter()
            .filter_map(|(key, message)| TaskRun::from_bytes(&message).ok().map(|task| (key, task)))
            .collect::<Vec<(String, TaskRun)>>()
    }

    /// Convert a file id to a channel
    fn file_id_to_channel(file_id: Uuid) -> String {
        format!("scheduled-tasks-{file_id}")
    }

    /// Parse the file id from a channel
    fn channel_to_file_id(channel: &str) -> Result<Uuid> {
        let file_id = channel
            .strip_prefix("scheduled-tasks-")
            .ok_or_else(|| ControllerError::PubSub("Invalid channel format".into()))?;

        Uuid::parse_str(file_id).map_err(|e| ControllerError::PubSub(e.to_string()))
    }
}

impl State {
    /// Check if the PubSub connection is healthy
    pub(crate) async fn pubsub_is_healthy(&self) -> bool {
        self.pubsub.lock().await.is_healthy().await
    }

    /// Reconnect to the PubSub server if it is unhealthy
    pub(crate) async fn reconnect_pubsub_if_unhealthy(&self) {
        self.pubsub.lock().await.reconnect_if_unhealthy().await;
    }

    /// Subscribe to the PubSub channel
    pub(crate) async fn subscribe_pubsub(&self, file_id: Uuid) -> Result<()> {
        let channel = PubSub::file_id_to_channel(file_id);
        self.pubsub
            .lock()
            .await
            .connection
            .subscribe_with_first_message(&channel, GROUP, None)
            .await
            .map_err(|e| ControllerError::PubSub(e.to_string()))?;

        Ok(())
    }

    /// Add tasks to the PubSub channel for a file
    pub(crate) async fn add_tasks(&self, tasks: Vec<TaskRun>) -> Result<()> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;
        let mut file_ids = HashSet::new();

        trace!("Adding tasks to PubSub: {tasks:?}");

        for task in tasks {
            let task_bytes = task
                .as_bytes()
                .map_err(|e| ControllerError::PubSub(e.to_string()))?;

            // publish the task to the file_id channel
            pubsub
                .connection
                .publish(
                    &PubSub::file_id_to_channel(task.file_id),
                    "*",
                    &task_bytes,
                    Some(ACTIVE_CHANNELS),
                )
                .await
                .map_err(|e| {
                    ControllerError::PubSub(format!(
                        "Error publishing task {task:?} to {SCHEDULED_TASKS_CHANNEL}: {e}"
                    ))
                })?;

            file_ids.insert(task.file_id);
        }

        Ok(())
    }

    /// Get tasks for a file
    pub(crate) async fn get_active_channels(&self) -> Result<HashSet<String>> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;

        let channels = pubsub
            .connection
            .active_channels(ACTIVE_CHANNELS)
            .await
            .map_err(|e| ControllerError::PubSub(e.to_string()))?
            .into_iter()
            .collect::<HashSet<_>>();

        trace!("Got {} active channels in pubsub", channels.len());

        Ok(channels)
    }

    /// Get tasks for a file
    pub(crate) async fn get_tasks_for_file(&self, file_id: Uuid) -> Result<Vec<(String, TaskRun)>> {
        self.reconnect_pubsub_if_unhealthy().await;
        self.subscribe_pubsub(file_id).await?;

        let channel = PubSub::file_id_to_channel(file_id);
        let mut pubsub = self.pubsub.lock().await;

        trace!(
            "Fetching messages from PubSub channel: {} for file {}",
            channel, file_id
        );

        let task_runs = pubsub
            .connection
            .messages(&channel, GROUP, CONSUMER, None, 100, true)
            .await
            .map_err(|e| ControllerError::PubSub(e.to_string()))?;

        if task_runs.is_empty() {
            info!(
                "No messages found in PubSub channel {} for file {} - channel is in active list but has no pending messages",
                channel, file_id
            );
        } else {
            info!(
                "Got {} task run(s) from PubSub channel {} for file {}",
                task_runs.len(),
                channel,
                file_id
            );
        }

        Ok(PubSub::messages_to_tasks(task_runs))
    }

    /// Acknowledge a task after it has been processed by the worker
    pub(crate) async fn ack_tasks(&self, file_id: Uuid, keys: Vec<String>) -> Result<()> {
        self.reconnect_pubsub_if_unhealthy().await;
        self.subscribe_pubsub(file_id).await?;

        let mut pubsub = self.pubsub.lock().await;
        let keys_refs = keys.iter().map(|s| s.as_str()).collect::<Vec<_>>();

        trace!("Acknowledging tasks for file {file_id}: {keys:?}");

        pubsub
            .connection
            .ack(
                &PubSub::file_id_to_channel(file_id),
                GROUP,
                keys_refs,
                Some(ACTIVE_CHANNELS),
                true,
            )
            .await
            .map_err(|e| ControllerError::PubSub(e.to_string()))?;

        Ok(())
    }

    /// Get all file ids from the active channel
    pub(crate) async fn get_file_ids_to_process(&self) -> Result<HashSet<Uuid>> {
        let active_channels = self.get_active_channels().await?;
        let file_ids = active_channels
            .iter()
            .map(|channel| PubSub::channel_to_file_id(channel))
            .collect::<Result<HashSet<_>>>()?;

        Ok(file_ids)
    }
}
