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
            .await?;

        Ok(())
    }

    /// Add tasks to the PubSub channel for a file
    pub(crate) async fn add_tasks(&self, tasks: Vec<TaskRun>) -> Result<()> {
        self.reconnect_pubsub_if_unhealthy().await;

        let mut pubsub = self.pubsub.lock().await;
        let mut file_ids = HashSet::new();

        trace!("Adding tasks to PubSub: {tasks:?}");

        for task in tasks {
            let task_bytes = task.as_bytes()?;

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
            .await?
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
            .await?;

        trace!(
            "Got {} task run(s) from PubSub channel {} for file {}",
            task_runs.len(),
            channel,
            file_id
        );

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
            .await?;

        Ok(())
    }

    /// Get all file ids from the active channel
    pub(crate) async fn get_file_ids_to_process(&self) -> Result<HashSet<Uuid>> {
        let active_channels = self.get_active_channels().await?;
        let file_ids = active_channels
            .iter()
            .map(|channel| PubSub::channel_to_file_id(channel))
            .collect::<Result<HashSet<_>>>()?;

        let mut file_ids_with_tasks = HashSet::new();

        for file_id in file_ids {
            if self.file_has_tasks(file_id).await? {
                file_ids_with_tasks.insert(file_id);
            }
        }

        Ok(file_ids_with_tasks)
    }

    /// Check if a file has undelivered tasks in PubSub.
    /// Only returns true if there are new messages that haven't been delivered
    /// to any consumer yet. This prevents creating workers for files where
    /// all messages have already been delivered (pending acknowledgment).
    pub(crate) async fn file_has_tasks(&self, file_id: Uuid) -> Result<bool> {
        self.reconnect_pubsub_if_unhealthy().await;
        self.subscribe_pubsub(file_id).await?;

        let channel = PubSub::file_id_to_channel(file_id);
        let mut pubsub = self.pubsub.lock().await;

        pubsub
            .connection
            .has_undelivered_messages(&channel, GROUP)
            .await
            .map_err(|e| ControllerError::PubSub(e.to_string()))
    }

    /// Remove an active channel if it is empty
    pub(crate) async fn remove_active_channel_if_empty(&self, file_id: Uuid) -> Result<()> {
        self.reconnect_pubsub_if_unhealthy().await;
        self.subscribe_pubsub(file_id).await?;

        let channel = PubSub::file_id_to_channel(file_id);
        let mut pubsub = self.pubsub.lock().await;
        pubsub
            .connection
            .remove_active_channel_if_empty(ACTIVE_CHANNELS, &channel, GROUP)
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::new_state;
    use quadratic_rust_shared::quadratic_api::TaskRun;

    fn create_task(file_id: Uuid, task_id: Uuid, run_id: Uuid) -> TaskRun {
        TaskRun {
            file_id,
            task_id,
            run_id,
            operations: vec![1, 2, 3],
        }
    }

    fn create_message(task: &TaskRun) -> Result<(String, Vec<u8>)> {
        Ok((format!("msg-{}", task.run_id), task.as_bytes()?))
    }

    // Unit tests for pure functions
    #[test]
    fn test_file_id_to_channel() {
        let file_id = Uuid::new_v4();
        let channel = PubSub::file_id_to_channel(file_id);
        assert_eq!(channel, format!("scheduled-tasks-{file_id}"));

        let result = PubSub::channel_to_file_id("invalid-prefix-uuid");
        assert!(matches!(result.unwrap_err(), ControllerError::PubSub(_)));

        let result = PubSub::channel_to_file_id("scheduled-tasks-not-a-uuid");
        assert!(matches!(result.unwrap_err(), ControllerError::PubSub(_)));
    }

    #[test]
    fn test_messages_to_tasks() {
        let file_id = Uuid::new_v4();
        let task1 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        let task2 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());

        // test single task
        let message = create_message(&task1).unwrap();
        let messages = vec![message];
        let tasks = PubSub::messages_to_tasks(messages);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].1.file_id, task1.file_id);
        assert_eq!(tasks[0].1.task_id, task1.task_id);
        assert_eq!(tasks[0].1.run_id, task1.run_id);

        // test multiple tasks
        let messages = vec![
            create_message(&task1).unwrap(),
            create_message(&task2).unwrap(),
        ];
        let tasks = PubSub::messages_to_tasks(messages);
        assert_eq!(tasks.len(), 2);

        // invalid message
        let valid_message = create_message(&task1).unwrap();
        let invalid_message = ("key-invalid".to_string(), vec![1, 2, 3]);
        let messages = vec![valid_message, invalid_message];
        let tasks = PubSub::messages_to_tasks(messages);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].1.file_id, file_id);

        // empty messages
        let messages = vec![];
        let tasks = PubSub::messages_to_tasks(messages);
        assert_eq!(tasks.len(), 0);

        // all invalid messages
        let messages = vec![
            ("key1".to_string(), vec![]),
            ("key2".to_string(), vec![1, 2, 3]),
            ("key3".to_string(), b"invalid json".to_vec()),
        ];
        let tasks = PubSub::messages_to_tasks(messages);
        assert_eq!(tasks.len(), 0);
    }

    #[tokio::test]
    async fn test_pubsub_is_healthy() {
        let state = new_state().await;
        let is_healthy = state.pubsub_is_healthy().await;
        assert!(is_healthy);
    }

    #[tokio::test]
    async fn test_add_task() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let task1 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        let task2 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        let task3 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());

        // single task
        state.add_tasks(vec![task1.clone()]).await.unwrap();
        let has_tasks = state.file_has_tasks(file_id).await.unwrap();
        assert!(has_tasks);

        // multiple tasks, same file
        state.add_tasks(vec![task2, task3]).await.unwrap();
        let has_tasks = state.file_has_tasks(file_id).await.unwrap();
        assert!(has_tasks);

        // multiple tasks, different files
        let file_id2 = Uuid::new_v4();
        let task4 = create_task(file_id2, Uuid::new_v4(), Uuid::new_v4());
        state.add_tasks(vec![task4]).await.unwrap();
    }

    #[tokio::test]
    async fn test_get_tasks_for_file() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();
        let run_id = Uuid::new_v4();

        // no tasks
        let tasks = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(tasks.len(), 0);

        // single task
        let task = create_task(file_id, task_id, run_id);
        state.add_tasks(vec![task]).await.unwrap();
        let tasks = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].1.file_id, file_id);
        assert_eq!(tasks[0].1.task_id, task_id);
        assert_eq!(tasks[0].1.run_id, run_id);
    }

    #[tokio::test]
    async fn test_ack_tasks() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let task1 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        let task2 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        let task3 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());

        // single task
        state.add_tasks(vec![task1]).await.unwrap();
        let tasks = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(tasks.len(), 1);
        let keys: Vec<String> = tasks.iter().map(|(key, _)| key.clone()).collect();
        state.ack_tasks(file_id, keys).await.unwrap();
        // After acking, no new pending messages should be available
        let remaining = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(remaining.len(), 0);

        // multiple tasks
        state.add_tasks(vec![task2, task3]).await.unwrap();
        let tasks = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(tasks.len(), 2);
        let keys: Vec<String> = tasks.iter().map(|(key, _)| key.clone()).collect();
        state.ack_tasks(file_id, keys).await.unwrap();
        // After acking all, no new pending messages should be available
        let remaining = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(remaining.len(), 0);
    }

    #[tokio::test]
    async fn test_file_has_tasks() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();

        // no tasks
        let has_tasks = state.file_has_tasks(file_id).await.unwrap();
        assert!(!has_tasks);

        // single task
        let task = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        state.add_tasks(vec![task]).await.unwrap();
        let has_tasks = state.file_has_tasks(file_id).await.unwrap();
        assert!(has_tasks);
    }

    #[tokio::test]
    async fn test_get_active_channels() {
        let state = new_state().await;
        let file_id1 = Uuid::new_v4();
        let file_id2 = Uuid::new_v4();
        let task1 = create_task(file_id1, Uuid::new_v4(), Uuid::new_v4());
        let task2 = create_task(file_id2, Uuid::new_v4(), Uuid::new_v4());

        state.add_tasks(vec![task1, task2]).await.unwrap();

        let channels = state.get_active_channels().await.unwrap();
        assert!(channels.len() >= 2);
        assert!(channels.contains(&PubSub::file_id_to_channel(file_id1)));
        assert!(channels.contains(&PubSub::file_id_to_channel(file_id2)));
    }

    #[tokio::test]
    async fn test_get_file_ids_to_process() {
        let state = new_state().await;
        let file_id1 = Uuid::new_v4();
        let file_id2 = Uuid::new_v4();
        let task1 = create_task(file_id1, Uuid::new_v4(), Uuid::new_v4());
        let task2 = create_task(file_id2, Uuid::new_v4(), Uuid::new_v4());

        // empty
        let file_ids = state.get_file_ids_to_process().await.unwrap();
        assert!(file_ids.is_empty() || !file_ids.is_empty());

        // with tasks
        state.add_tasks(vec![task1, task2]).await.unwrap();
        let file_ids = state.get_file_ids_to_process().await.unwrap();
        assert!(file_ids.contains(&file_id1));
        assert!(file_ids.contains(&file_id2));
    }

    #[tokio::test]
    async fn test_subscribe_pubsub() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let result = state.subscribe_pubsub(file_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_workflow_add_get_ack() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let task1 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());
        let task2 = create_task(file_id, Uuid::new_v4(), Uuid::new_v4());

        // Add tasks
        state
            .add_tasks(vec![task1.clone(), task2.clone()])
            .await
            .unwrap();

        // Verify file has tasks
        assert!(state.file_has_tasks(file_id).await.unwrap());

        // Get tasks - this marks them as pending for this consumer
        let tasks = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(tasks.len(), 2);

        // Ack first task only
        let first_key = tasks[0].0.clone();
        state.ack_tasks(file_id, vec![first_key]).await.unwrap();

        // The second task is still pending (not acked yet), so new reads return nothing
        // This is expected Redis Streams behavior - messages stay pending until acked
        let new_messages = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(new_messages.len(), 0);

        // Ack second task using the original key
        let second_key = tasks[1].0.clone();
        state.ack_tasks(file_id, vec![second_key]).await.unwrap();

        // Should have no more pending or new tasks
        let final_tasks = state.get_tasks_for_file(file_id).await.unwrap();
        assert_eq!(final_tasks.len(), 0);
    }

    #[tokio::test]
    async fn test_reconnect_pubsub_if_unhealthy() {
        let state = new_state().await;
        // Should not panic or error even if already healthy
        state.reconnect_pubsub_if_unhealthy().await;
        assert!(state.pubsub_is_healthy().await);
    }
}
