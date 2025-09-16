use std::collections::HashSet;

use anyhow::Result;
use quadratic_rust_shared::{
    pubsub::{Config as PubSubConfig, PubSub as PubSubTrait, redis_streams::RedisConnection},
    quadratic_api::Task,
};
use tracing::{error, info};
use uuid::Uuid;

use super::State;

static GROUP_NAME: &str = "quadratic-cloud";
static ACTIVE_FILE_CHANNEL_SET: &str = "quadratic-cloud-active-file-channel-set";
static FILE_TASKS_CONSUMER: &str = "quadratic-cloud-file-tasks-consumer";
static TASK_DEDUPE_KEY_PREFIX: &str = "quadratic-cloud-task";

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
        let connection = RedisConnection::new(config.to_owned()).await?;

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

    /// Add tasks to the PubSub channel for a file
    pub(crate) async fn add_tasks(&self, tasks: Vec<Task>) -> Result<()> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;

        let mut file_ids = HashSet::new();

        for task in tasks {
            // publish the task to the file_id channel
            match pubsub
                .connection
                .publish_once_with_dedupe_key(
                    TASK_DEDUPE_KEY_PREFIX,
                    &task.file_id.to_string(),
                    &task.task_id.to_string(),
                    &task.as_bytes()?,
                    Some(ACTIVE_FILE_CHANNEL_SET),
                )
                .await
            {
                Ok(true) => {
                    file_ids.insert(task.file_id);
                }
                Ok(false) => (),
                Err(e) => {
                    error!("Error publishing task {task:?} to {ACTIVE_FILE_CHANNEL_SET}: {e}");
                }
            }
        }

        Ok(())
    }

    /// Get tasks for a file
    pub(crate) async fn get_tasks_for_file(&self, file_id: Uuid) -> Result<Vec<Task>> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;

        pubsub
            .connection
            .subscribe(&file_id.to_string(), GROUP_NAME, Some("0"))
            .await?;

        let messages = pubsub
            .connection
            .messages_with_dedupe_key(
                &file_id.to_string(),
                GROUP_NAME,
                FILE_TASKS_CONSUMER,
                None,
                10,
                true,
            )
            .await?;

        let tasks = messages
            .into_iter()
            .flat_map(|(_, task)| match Task::from_bytes(&task) {
                Ok(task) => Some(task),
                Err(e) => {
                    error!("Invalid task for file {file_id:?}, error: {e}");
                    None
                }
            })
            .collect::<Vec<_>>();

        Ok(tasks)
    }

    /// Acknowledge a task after it has been processed by the worker
    pub(crate) async fn ack_tasks(&self, file_id: Uuid, task_ids: Vec<Uuid>) -> Result<()> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;

        pubsub
            .connection
            .subscribe(&file_id.to_string(), GROUP_NAME, Some("0"))
            .await?;

        // acknowledge the tasks, removing them from the file_id channel and the active channel
        for task_id in task_ids {
            pubsub
                .connection
                .ack_once(
                    TASK_DEDUPE_KEY_PREFIX,
                    &file_id.to_string(),
                    GROUP_NAME,
                    &task_id.to_string(),
                    Some(ACTIVE_FILE_CHANNEL_SET),
                )
                .await?;
        }

        Ok(())
    }

    /// Get all file ids from the active channel
    pub(crate) async fn get_file_ids_to_process(&self) -> Result<HashSet<Uuid>> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;

        let file_ids = pubsub
            .connection
            .active_channels(ACTIVE_FILE_CHANNEL_SET)
            .await?
            .into_iter()
            .flat_map(|file_id| Uuid::parse_str(&file_id))
            .collect::<HashSet<_>>();

        Ok(file_ids)
    }
}
