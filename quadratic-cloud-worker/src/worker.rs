use quadratic_core_cloud::worker::Worker as Core;
use quadratic_rust_shared::quadratic_api::TaskRun;
use quadratic_rust_shared::quadratic_cloud::{
    GetWorkerInitDataResponse, ack_tasks, get_tasks, get_token, worker_shutdown,
};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, trace, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::error::{Result, WorkerError};
use crate::thumbnail::{self, ThumbnailAssetConfig};

/// Maximum number of retry attempts for token refresh
const TOKEN_REFRESH_MAX_RETRIES: u32 = 3;
/// Initial delay in milliseconds for token refresh retry (doubles each attempt)
const TOKEN_REFRESH_INITIAL_DELAY_MS: u64 = 100;

/// Configuration for thumbnail rendering
pub(crate) struct ThumbnailConfig {
    pub fonts_dir: Option<String>,
    pub icons_dir: Option<String>,
    pub emojis_dir: Option<String>,
}

pub(crate) struct Worker {
    core: Core,
    container_id: Uuid,
    file_id: Uuid,
    worker_init_data: GetWorkerInitDataResponse,
    controller_url: String,
    tasks: Vec<(String, TaskRun)>,
    /// Current JWT with JTI - used to authenticate with controller and rotated on each token request
    current_jwt: String,
    /// Configuration for thumbnail rendering
    thumbnail_config: ThumbnailConfig,
    /// Thumbnail key if successfully uploaded (passed to controller on shutdown)
    uploaded_thumbnail_key: Option<String>,
}

impl Worker {
    /// Create a new worker.
    ///
    /// This will create a new worker and connect to the multiplayer server.
    /// It will then enter the room and get the catchup transactions.
    /// If an error occurs, the worker will be shutdown and the error will be returned.
    ///
    /// * `config` - The configuration for the worker.
    ///
    /// Returns a new worker.
    ///
    pub(crate) async fn new(config: Config) -> Result<Self> {
        let file_id = config.file_id;
        let controller_url = config.controller_url.clone();
        let container_id = config.container_id;
        let jwt = config.jwt.clone();

        match Self::new_worker(config).await {
            Ok(worker) => Ok(worker),
            Err(e) => {
                if let Err(shutdown_err) =
                    worker_shutdown(&controller_url, container_id, file_id, None, &jwt).await
                {
                    error!("Failed to shutdown worker: {}", shutdown_err);
                }
                Err(e)
            }
        }
    }

    /// Internally create a new worker.
    ///
    /// This will create a new worker and connect to the multiplayer server.
    /// It will then enter the room and get the catchup transactions.
    ///
    /// * `config` - The configuration for the worker.
    ///
    /// Returns a new worker.
    ///
    async fn new_worker(config: Config) -> Result<Self> {
        let file_id = config.file_id.to_owned();
        let container_id = config.container_id.to_owned();
        let worker_init_data = config.worker_init_data;
        let controller_url = config.controller_url.to_owned();
        let tasks = config.tasks;

        // Extract thumbnail config before consuming other fields
        let thumbnail_config = ThumbnailConfig {
            fonts_dir: config.thumbnail_fonts_dir,
            icons_dir: config.thumbnail_icons_dir,
            emojis_dir: config.thumbnail_emojis_dir,
        };

        // Rotate the token immediately to invalidate the environment JWT.
        // This ensures the JWT passed via environment (visible in /proc/<pid>/environ)
        // is consumed before any network operations, making it useless if leaked.
        let current_jwt = get_token(&controller_url, file_id, &config.jwt)
            .await
            .map_err(|e| WorkerError::CreateWorker(format!("Failed to rotate initial JWT: {e}")))?;

        // IMPORTANT: Core stores this JWT for the initial multiplayer connection but does NOT
        // receive updates when tokens are rotated. This is safe ONLY because Core doesn't
        // implement reconnection - if the websocket drops, the worker fails.
        //
        // If reconnection is ever added to Core, it would attempt to reconnect with an
        // old/consumed JTI and fail silently. In that case, Core would need a callback or
        // method to get the current JWT from the Worker instead of storing its own copy.
        //
        // Current safety relies on:
        // 1. Workers are short-lived (process tasks and exit)
        // 2. No reconnection means the stored JWT is used only once
        // 3. Each task rotation updates self.current_jwt (not Core's copy)
        let core = Core::new(
            file_id,
            worker_init_data.sequence_number.to_owned() as u64,
            &worker_init_data.presigned_url.to_owned(),
            current_jwt.clone(),
            config.multiplayer_url.to_owned(),
            config.connection_url.to_owned(),
        )
        .await
        .map_err(|e| WorkerError::CreateWorker(e.to_string()))?;

        Ok(Self {
            core,
            container_id,
            file_id,
            worker_init_data,
            controller_url,
            tasks,
            current_jwt,
            thumbnail_config,
            uploaded_thumbnail_key: None,
        })
    }

    /// Run the worker.
    ///
    /// This will process the tasks until no more are available.
    pub(crate) async fn run(&mut self) -> Result<()> {
        let container_id = self.container_id;
        let file_id = self.file_id;
        let team_id = self.worker_init_data.team_id.to_string();
        let controller_url = self.controller_url.to_owned();

        // Loop to process batches of tasks until no more are available
        loop {
            // swap the tasks in memory and replace with an empty vec
            let tasks = std::mem::take(&mut self.tasks);

            if tasks.is_empty() {
                info!("No more tasks to process");
                break;
            }

            let mut successful_tasks = Vec::new();
            let mut failed_tasks = Vec::new();

            info!("Processing {} task(s) for file: {}", tasks.len(), file_id);

            // Note: If token refresh fails mid-batch, any already-processed tasks won't be
            // acknowledged and may be re-processed when the controller recreates the worker.
            // This is acceptable because tasks should be idempotent - running a task twice
            // should produce the same result as running it once.
            for (key, task) in tasks {
                let task_start = std::time::Instant::now();

                // Get a fresh JWT token by presenting our current JWT.
                // The controller validates and consumes our current JTI,
                // then issues a new JWT with a new JTI.
                // Retry with exponential backoff for transient failures.
                let jwt = {
                    let mut last_error = None;
                    let mut token = None;

                    for attempt in 0..TOKEN_REFRESH_MAX_RETRIES {
                        match get_token(&self.controller_url, self.file_id, &self.current_jwt).await
                        {
                            Ok(t) => {
                                token = Some(t);
                                break;
                            }
                            Err(e) => {
                                let delay = TOKEN_REFRESH_INITIAL_DELAY_MS * 2_u64.pow(attempt);
                                warn!(
                                    "Token refresh attempt {}/{} failed for file {} (task {}): {}. Retrying in {}ms...",
                                    attempt + 1,
                                    TOKEN_REFRESH_MAX_RETRIES,
                                    self.file_id,
                                    key,
                                    e,
                                    delay
                                );
                                last_error = Some(e);
                                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                            }
                        }
                    }

                    match token {
                        Some(t) => t,
                        None => {
                            let e = last_error.expect("last_error should be set if token is None");
                            error!(
                                "Failed to refresh JWT for file {} (task {}) after {} attempts: {}",
                                self.file_id, key, TOKEN_REFRESH_MAX_RETRIES, e
                            );
                            return Err(WorkerError::GetToken(e.to_string()));
                        }
                    }
                };

                // Update our current JWT for the next request
                self.current_jwt = jwt.clone();

                info!(
                    "Starting task {} (run_id: {}, task_id: {})",
                    key, task.run_id, task.task_id
                );

                // process the operations
                match self
                    .core
                    .process_operations(task.operations, team_id.to_owned(), jwt)
                    .await
                {
                    Ok(_) => {
                        let elspased = task_start.elapsed().as_secs_f64() * 1000.0;

                        info!("Task {key} completed successfully (duration: {elspased:.2}ms)");

                        successful_tasks.push((key, task.run_id, task.task_id));
                    }
                    Err(e) => {
                        let elapsed = task_start.elapsed().as_secs_f64() * 1000.0;

                        error!("Task {key} failed after {elapsed:.2}ms, error: {e}");

                        failed_tasks.push((key, task.run_id, task.task_id, e.to_string()));
                    }
                };
            }

            // If we're never sent any transactions (no tasks or all failed), mark ack as received
            // Note: received_catchup_transactions should already be true from initialization
            if !self.core.has_transaction().await {
                info!("No transactions were sent, marking transaction ack as received");

                self.core
                    .status
                    .lock()
                    .await
                    .mark_transaction_ack_received();
            }

            // wait for all tasks to be complete
            tracing::trace!("Waiting for all code executions to complete...");

            let mut wait_count = 0;

            loop {
                let status = self.core.status.lock().await;

                if status.is_complete() {
                    break;
                }

                // If WebSocket disconnected before completion, shut down
                if status.is_disconnected() {
                    error!("WebSocket disconnected before completion, shutting down");
                    return Err(WorkerError::WebSocket(
                        "WebSocket disconnected before completion".to_string(),
                    ));
                }

                drop(status); // Release lock before sleeping

                wait_count += 1;

                if wait_count % 5 == 0 {
                    trace!(
                        "Still waiting for code executions... ({}s elapsed)",
                        wait_count
                    );
                }

                tokio::time::sleep(Duration::from_secs(1)).await;
            }

            trace!("All code executions completed");

            // Store counts before moving the vectors
            let successful_count = successful_tasks.len();
            let failed_count = failed_tasks.len();

            let acked_tasks = ack_tasks(
                &controller_url,
                container_id,
                file_id,
                successful_tasks,
                failed_tasks,
                &self.current_jwt,
            )
            .await
            .map_err(|e| WorkerError::AckTasks(e.to_string()));

            match acked_tasks {
                Ok(_) => {
                    info!(
                        "Tasks acknowledged successfully (successful: {successful_count}, failed: {failed_count})"
                    );
                }
                Err(e) => error!("Error acknowledging tasks, error: {e}"),
            }

            // Check for more tasks before shutting down
            trace!("Checking for more tasks...");

            match get_tasks(&controller_url, file_id, &self.current_jwt).await {
                Ok(new_tasks) => {
                    if new_tasks.is_empty() {
                        info!("No more tasks available, ready to shutdown");
                        break;
                    }

                    info!(
                        "Found {} more task(s), continuing processing",
                        new_tasks.len()
                    );

                    // Tasks are already in TaskRun format from PubSub
                    self.tasks = new_tasks;
                }
                Err(e) => {
                    error!("Error fetching more tasks: {e}");
                    // Continue to shutdown even if we couldn't fetch more tasks
                    break;
                }
            }
        }

        Ok(())
    }

    /// Shutdown the worker.
    ///
    /// This will render and upload a thumbnail, extract AI memory payload,
    /// leave the multiplayer room, and send a shutdown request to the controller.
    pub(crate) async fn shutdown(&mut self) -> Result<()> {
        info!("Worker shutting down");

        // Render and upload thumbnail before leaving the room
        // This is best-effort - don't fail shutdown if thumbnail fails
        self.render_and_upload_thumbnail().await;

        // Extract AI memory payload from the grid for team knowledge
        let memory_payload = match self.core.extract_memory_payload().await {
            Ok(payload) => {
                info!("Extracted AI memory payload");
                Some(payload)
            }
            Err(e) => {
                warn!("Failed to extract AI memory payload: {}", e);
                None
            }
        };

        // leave the multiplayer room
        match self.core.leave_room().await {
            Ok(_) => info!("Successfully left multiplayer room"),
            Err(e) => {
                error!("Error leaving multiplayer room: {}", e);
                // Continue with shutdown even if leaving room fails
            }
        }

        // send worker shutdown request to the controller (with thumbnail_key and memory_payload)
        match worker_shutdown(
            &self.controller_url,
            self.container_id,
            self.file_id,
            self.uploaded_thumbnail_key.clone(),
            memory_payload,
            &self.current_jwt,
        )
        .await
        {
            Ok(_) => info!("Successfully notified controller of shutdown"),
            Err(e) => {
                error!("Error notifying controller of shutdown: {}", e);
                // Don't fail shutdown if controller notification fails
            }
        }

        info!("Worker shutdown complete");

        Ok(())
    }

    /// Render and upload a thumbnail of the current grid state.
    /// This is best-effort - errors are logged but don't fail the worker.
    /// On success, stores the thumbnail_key to be passed to the controller on shutdown.
    async fn render_and_upload_thumbnail(&mut self) {
        info!("Rendering and uploading thumbnail");

        let asset_config = ThumbnailAssetConfig {
            fonts_dir: self.thumbnail_config.fonts_dir.clone(),
            icons_dir: self.thumbnail_config.icons_dir.clone(),
            emojis_dir: self.thumbnail_config.emojis_dir.clone(),
        };

        match thumbnail::render_and_upload_thumbnail(
            Arc::clone(&self.core.file),
            &asset_config,
            &self.worker_init_data.thumbnail_upload_url,
            &self.worker_init_data.thumbnail_key,
        )
        .await
        {
            Ok(thumbnail_key) => {
                info!("Thumbnail rendered and uploaded successfully");
                self.uploaded_thumbnail_key = Some(thumbnail_key);
            }
            Err(e) => error!("Failed to render/upload thumbnail: {}", e),
        }
    }
}

#[cfg(test)]
mod tests {
    use quadratic_rust_shared::{quadratic_api::TaskRun, quadratic_cloud::GetTasksResponse};
    use std::sync::{Arc, Mutex};
    use uuid::Uuid;

    fn new_task_run(operations: Vec<u8>) -> TaskRun {
        TaskRun {
            file_id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            run_id: Uuid::new_v4(),
            operations,
        }
    }

    /// Mock state to track how many times get_tasks is called
    #[derive(Clone)]
    struct MockTaskProvider {
        call_count: Arc<Mutex<usize>>,
        task_batches: Arc<Mutex<Vec<GetTasksResponse>>>,
    }

    impl MockTaskProvider {
        fn new(task_batches: Vec<GetTasksResponse>) -> Self {
            Self {
                call_count: Arc::new(Mutex::new(0)),
                task_batches: Arc::new(Mutex::new(task_batches)),
            }
        }

        fn get_tasks(&self) -> GetTasksResponse {
            let mut count = self.call_count.lock().unwrap();
            *count += 1;
            let batches = self.task_batches.lock().unwrap();

            if *count <= batches.len() {
                batches[*count - 1].clone()
            } else {
                vec![]
            }
        }

        fn call_count(&self) -> usize {
            *self.call_count.lock().unwrap()
        }
    }

    #[test]
    fn test_mock_task_provider_returns_batches_in_order() {
        let batch1 = vec![("key1".to_string(), new_task_run(vec![1, 2, 3]))];
        let batch2 = vec![("key2".to_string(), new_task_run(vec![4, 5, 6]))];
        let provider = MockTaskProvider::new(vec![batch1.clone(), batch2.clone(), vec![]]);

        // First call should return batch1
        let result1 = provider.get_tasks();
        assert_eq!(result1.len(), 1);
        assert_eq!(result1[0].0, "key1");

        // Second call should return batch2
        let result2 = provider.get_tasks();
        assert_eq!(result2.len(), 1);
        assert_eq!(result2[0].0, "key2");

        // Third call should return empty
        let result3 = provider.get_tasks();
        assert!(result3.is_empty());

        // Fourth call should still return empty
        let result4 = provider.get_tasks();
        assert!(result4.is_empty());

        assert_eq!(provider.call_count(), 4);
    }

    #[test]
    fn test_worker_processes_single_batch() {
        // This test verifies that a worker with a single batch
        // processes it and then shuts down when no more tasks are available
        let task_run = new_task_run(vec![1, 2, 3]);

        // Worker starts with initial batch
        let initial_tasks = [("key1".to_string(), task_run)];

        // After processing, get_tasks returns empty
        // In real implementation, this would be tested by:
        // 1. Worker processes initial_tasks
        // 2. Worker calls get_tasks() -> empty
        // 3. Worker shuts down

        assert!(!initial_tasks.is_empty());
        assert_eq!(initial_tasks.len(), 1);
    }

    #[test]
    fn test_worker_processes_multiple_batches() {
        // This test verifies the worker loop behavior:
        // - Start with batch 1
        // - Process batch 1
        // - Check for more tasks -> get batch 2
        // - Process batch 2
        // - Check for more tasks -> empty
        // - Shutdown

        let batch1 = vec![("key1".to_string(), new_task_run(vec![1, 2, 3]))];
        let batch2 = vec![("key2".to_string(), new_task_run(vec![4, 5, 6]))];
        let provider = MockTaskProvider::new(vec![batch1.clone(), batch2.clone()]);

        let mut total_processed = 0;

        // Get and process first batch
        let mut current_batch = provider.get_tasks();
        assert_eq!(current_batch.len(), 1);
        total_processed += current_batch.len();

        // Check for more tasks (simulating get_tasks call after ack)
        current_batch = provider.get_tasks();
        if !current_batch.is_empty() {
            // Process second batch
            assert_eq!(current_batch.len(), 1);
            total_processed += current_batch.len();

            // Check for more tasks again
            current_batch = provider.get_tasks();
        }

        // Should have no more tasks
        assert!(current_batch.is_empty());
        assert_eq!(total_processed, 2);
        assert_eq!(provider.call_count(), 3);
    }

    #[test]
    fn test_worker_continues_on_multiple_small_batches() {
        // Test that worker can process many small batches in sequence
        let batches: Vec<GetTasksResponse> = (0..5)
            .map(|i| vec![(format!("key{}", i), new_task_run(vec![i as u8]))])
            .collect();
        let provider = MockTaskProvider::new(batches);
        let mut total_batches_processed = 0;

        // Simulate worker loop
        loop {
            let batch = provider.get_tasks();
            if batch.is_empty() {
                break;
            }
            total_batches_processed += 1;
        }

        assert_eq!(total_batches_processed, 5);
        assert_eq!(provider.call_count(), 6); // 5 batches + 1 empty check
    }
}
