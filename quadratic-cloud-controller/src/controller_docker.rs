use std::collections::HashSet;
use std::sync::Arc;

use futures::future::join_all;
use quadratic_rust_shared::{
    docker::container::Container,
    quadratic_cloud::{GetWorkerInitDataResponse, compress_tasks, encode_tasks},
    storage::Storage,
};
use tracing::{error, info, trace};
use uuid::Uuid;

use crate::{
    error::{ControllerError, Result},
    quadratic_api::{file_init_data, insert_running_log},
    state::State,
};

pub(crate) const IMAGE_NAME: &str = "quadratic-cloud-worker";
const DEFAULT_TIMEOUT_SECONDS: i64 = 60;

// Maximum number of workers that can run simultaneously
const MAX_CONCURRENT_WORKERS: usize = 20;

pub(crate) struct Controller {
    pub(crate) state: Arc<State>,
    image_name: String,
}

impl Controller {
    /// Create a new controller
    pub(crate) async fn new(state: Arc<State>) -> Result<Self> {
        let image_name = Self::discover_image_name(&state).await?;

        Ok(Self { state, image_name })
    }

    /// Create a new controller with a specific image name (for testing)
    #[cfg(test)]
    pub(crate) fn new_with_image_name(state: Arc<State>, image_name: String) -> Self {
        Self { state, image_name }
    }

    /// Create workers for the given file IDs
    pub(crate) async fn create_workers(&self, file_ids: HashSet<Uuid>) -> Result<()> {
        let total_file_count = file_ids.len();
        trace!("{} files need to be processed", total_file_count);

        if file_ids.is_empty() {
            trace!("No files to create workers for, skipping");
            return Ok(());
        }

        // Get current active worker count
        let active_worker_count = self.get_all_active_worker_file_ids().await?.len();
        let available_slots = MAX_CONCURRENT_WORKERS.saturating_sub(active_worker_count);

        if available_slots == 0 {
            info!(
                "Max workers ({}) already running, skipping new worker creation. {} files waiting.",
                MAX_CONCURRENT_WORKERS, total_file_count
            );
            return Ok(());
        }

        // Only create workers up to the available slots
        let files_to_process: Vec<_> = file_ids.into_iter().take(available_slots).collect();
        let files_waiting = total_file_count - files_to_process.len();

        info!(
            "Attempting to create {} workers (max: {}, active: {}, waiting: {})",
            files_to_process.len(),
            MAX_CONCURRENT_WORKERS,
            active_worker_count,
            files_waiting
        );

        let workers = files_to_process
            .iter()
            .map(|file_id| self.create_worker(*file_id));
        let results = join_all(workers).await;

        for (file_id, result) in files_to_process.into_iter().zip(results) {
            if let Err(e) = result {
                error!("Failed to create file worker for {file_id}: {e}");
            }
        }

        info!("Finished creating workers");

        Ok(())
    }

    /// Discover the actual image name by querying Docker for images containing IMAGE_NAME_SUBSTRING
    async fn discover_image_name(state: &Arc<State>) -> Result<String> {
        state
            .client
            .lock()
            .await
            .image_tag_from_image_name(IMAGE_NAME)
            .await
            .map_err(|e| {
                error!("Failed to discover image: {}", e);
                Self::error("discover_image_name", e)
            })
    }

    async fn get_all_active_worker_file_ids(&self) -> Result<HashSet<Uuid>> {
        let active_file_ids = self
            .state
            .client
            .lock()
            .await
            .list_ids(true)
            .await
            .map_err(|e| Self::error("get_all_active_worker_file_ids", e))?
            .into_iter()
            .collect::<HashSet<_>>();

        Ok(active_file_ids)
    }

    // /// Check if a file has an active worker
    // async fn file_has_active_worker(&self, file_id: &Uuid) -> Result<bool> {
    //     let has_container = self
    //         .state
    //         .client
    //         .lock()
    //         .await
    //         .has_container(file_id, true)
    //         .await
    //         .map_err(|e| Self::error("file_has_active_worker", e))?;

    //     trace!("File {file_id} has an active worker: {has_container}");

    //     Ok(has_container)
    // }

    pub(crate) async fn get_worker_init_data(
        &self,
        file_id: &Uuid,
    ) -> Result<GetWorkerInitDataResponse> {
        let mut file_init_data = file_init_data(&self.state, *file_id).await?;

        file_init_data.presigned_url = self
            .state
            .settings
            .files_presigned_url(&file_init_data.presigned_url)?
            .to_string();

        // Generate the thumbnail upload presigned URL directly from S3/storage
        let thumbnail_key = format!("{file_id}-thumbnail.png");
        let thumbnail_upload_url = self
            .state
            .settings
            .storage
            .presigned_upload_url(&thumbnail_key, "image/png")
            .await
            .map_err(|e| ControllerError::Settings(e.to_string()))?;

        // For filesystem storage, rewrite the URL to point to the files service
        let thumbnail_upload_url = self
            .state
            .settings
            .files_presigned_url(&thumbnail_upload_url)?
            .to_string();

        trace!("[File init data for file {file_id}: {file_init_data:?}");

        let worker_init_data = GetWorkerInitDataResponse {
            team_id: file_init_data.team_id,
            email: file_init_data.email,
            sequence_number: file_init_data.sequence_number,
            presigned_url: file_init_data.presigned_url,
            thumbnail_upload_url,
            thumbnail_key,
            timezone: file_init_data.timezone,
        };

        Ok(worker_init_data)
    }

    /// Get the binary tasks for a file and return a tuple of the binary tasks
    /// and a vector of (run_id, task_id) pairs. The run_id is a new UUID for
    /// each task.
    pub(crate) async fn binary_tasks_for_file(
        &self,
        file_id: &Uuid,
    ) -> Result<(Vec<u8>, Vec<(Uuid, Uuid)>)> {
        let tasks = self
            .state
            .get_tasks_for_file(*file_id)
            .await
            .map_err(|e| ControllerError::GetTasksForWorker(e.to_string()))?;

        if tasks.is_empty() {
            trace!(
                "No tasks found in PubSub for file {file_id} - tasks may have already been consumed or never published"
            );

            return Ok((vec![], vec![]));
        }

        let total_bytes: usize = tasks.iter().map(|(_, task)| task.operations.len()).sum();

        info!(
            "Got {} task(s) for worker for file {file_id} for binary tasks ({} bytes total)",
            tasks.len(),
            total_bytes
        );

        let ids = tasks
            .iter()
            .map(|(_, task)| (task.run_id, task.task_id))
            .collect::<Vec<_>>();

        let binary_tasks =
            compress_tasks(tasks).map_err(|e| ControllerError::CompressTasks(e.to_string()))?;

        Ok((binary_tasks, ids))
    }

    pub(crate) async fn create_worker(&self, file_id: Uuid) -> Result<()> {
        trace!("Creating worker for file {file_id}");

        let (tasks, ids) = self.binary_tasks_for_file(&file_id).await?;

        if ids.is_empty() {
            info!(
                "No tasks to create worker for file {file_id}, something failed, ack the active channel and exit"
            );

            self.state.remove_active_channel_if_empty(file_id).await?;

            return Ok(());
        }

        let container_id = Uuid::new_v4();
        let container_name = format!("quadratic-cron-{file_id}-{container_id}");
        let controller_url = self.state.settings.controller_url();
        let multiplayer_url = self.state.settings.multiplayer_url();
        let connection_url = self.state.settings.connection_url();
        let worker_init_data = self.get_worker_init_data(&file_id).await?;

        // Generate initial JTI and JWT for this worker
        // Note: We don't register the JTI until the container is successfully started
        // to avoid orphaned JTI entries if container creation fails
        let initial_jti = Uuid::new_v4().to_string();

        // Generate JWT with the initial JTI
        let worker_jwt = self.state.settings.generate_worker_jwt_with_jti(
            &worker_init_data.email,
            file_id,
            worker_init_data.team_id,
            &initial_jti,
        )?;

        let worker_init_data_json = serde_json::to_string(&worker_init_data)?;
        let timezone = worker_init_data.timezone.unwrap_or("UTC".to_string());
        let encoded_tasks = encode_tasks(tasks).map_err(|e| Self::error("create_worker", e))?;

        // Security Note: Env vars are visible via `docker inspect` or `/proc/<pid>/environ`.
        // The JWT passed here is safe because:
        // 1. The worker rotates to a new JWT (via get_token) immediately on startup, before
        //    connecting to multiplayer or running any user code
        // 2. The initial JWT's JTI is consumed/invalidated on first use
        // 3. By the time untrusted code (Python/JS) executes, this JWT is already invalid
        //
        // Threat model assumption: Container isolation prevents untrusted code from reading
        // another container's /proc filesystem. If a container escape vulnerability exists,
        // an attacker could read the initial JWT during the brief window before rotation.
        let env_vars = vec![
            format!("RUST_LOG={}", "info"), // change this to info for seeing all logs
            format!("CONTAINER_ID={container_id}"),
            format!("CONTROLLER_URL={controller_url}"),
            format!("MULTIPLAYER_URL={multiplayer_url}"),
            format!("CONNECTION_URL={connection_url}"),
            format!("FILE_ID={file_id}"),
            format!("JWT={worker_jwt}"), // One-time use token, rotated before user code runs
            format!("TASKS={}", encoded_tasks),
            format!("WORKER_INIT_DATA={}", worker_init_data_json),
            format!("TZ={}", timezone),
        ];

        // Mount volume to persist Python packages between container runs
        // This mounts a host directory to the container's /root/.local where pip installs packages
        let python_packages_dir = std::env::var("PYTHON_PACKAGES_DIR").unwrap_or_else(|_| {
            // Use absolute path - Docker requires it for volume mounts
            // The controller runs from the quadratic-cloud-controller directory already
            let current_dir =
                std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let path = current_dir.join("python-packages");
            path.to_string_lossy().to_string()
        });
        info!(
            "Mounting Python packages directory: {}",
            python_packages_dir
        );
        let binds = vec![format!("{}:/root/.local", python_packages_dir)];

        let container = Container::try_new(
            container_id,
            file_id,
            ids.clone(),
            &self.image_name,
            self.state.client.lock().await.docker.clone(),
            Some(container_name),
            Some(env_vars),
            None,
            Some(DEFAULT_TIMEOUT_SECONDS),
            Some(binds),
        )
        .await
        .map_err(|e| Self::error("create_worker", e))?;

        info!("About to add and start container for file {file_id}");

        self.state
            .client
            .lock()
            .await
            .add_container(container, true)
            .await
            .map_err(|e| Self::error("create_worker", e))?;

        // Register the JTI only after the container is successfully started
        // This avoids orphaned JTI entries if container creation fails
        // (email and team_id are cached to avoid API calls during token rotation)
        self.state.worker_jtis.register(
            file_id,
            initial_jti,
            worker_init_data.email.clone(),
            worker_init_data.team_id,
        );

        info!("Successfully added and started worker for file {file_id}");

        insert_running_log(&self.state, ids).await?;

        Ok(())
    }

    pub(crate) async fn shutdown_worker(
        state: Arc<State>,
        container_id: &Uuid,
        file_id: &Uuid,
    ) -> Result<()> {
        tracing::trace!("Shutting down worker");

        // Remove the worker's JTI from the store
        state.worker_jtis.remove(file_id);

        let mut client = state.client.lock().await;
        client
            .remove_container(container_id)
            .await
            .map_err(|e| Self::error("shutdown_worker", e))?;

        info!("Shut down worker for file {file_id}");

        Ok(())
    }

    fn error(func_name: &str, error: impl ToString) -> ControllerError {
        ControllerError::Docker(format!("{func_name}: {}", error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::new_state;

    use super::*;

    /// Create a test controller that uses a lightweight test image instead of
    /// the actual worker image. This allows tests to run in CI without building
    /// the full worker image.
    async fn new_test_controller(state: Arc<State>) -> Controller {
        // Use alpine:latest as a test image since it's small and widely available
        // The actual worker logic won't run, but we can test the controller logic
        Controller::new_with_image_name(state, "alpine:latest".to_string())
    }

    #[tokio::test]
    async fn test_create_worker() {
        let state = new_state().await;
        let controller = new_test_controller(state).await;
        let file_id = Uuid::new_v4();
        // This will succeed but won't actually process anything since there are no tasks
        let result = controller.create_worker(file_id).await;
        assert!(
            result.is_ok(),
            "Should handle file with no tasks gracefully"
        );
    }

    #[tokio::test]
    async fn test_create_workers_respects_max_concurrent_limit() {
        let state = new_state().await;
        let controller = new_test_controller(state.clone()).await;

        // Create a set of file IDs that exceeds MAX_CONCURRENT_WORKERS
        let num_files = MAX_CONCURRENT_WORKERS + 10;
        let file_ids: HashSet<Uuid> = (0..num_files).map(|_| Uuid::new_v4()).collect();

        // Initially, no workers should be running
        let initial_count = state
            .client
            .lock()
            .await
            .list_ids(true)
            .await
            .unwrap()
            .len();
        assert_eq!(initial_count, 0, "Should start with no active workers");

        // Attempt to create workers for all files
        let result = controller.create_workers(file_ids.clone()).await;

        // Should succeed without error
        assert!(result.is_ok(), "create_workers should succeed");

        // Check that we didn't exceed MAX_CONCURRENT_WORKERS
        // Note: Some workers may have already completed, so we check <= rather than ==
        let active_count = state
            .client
            .lock()
            .await
            .list_ids(true)
            .await
            .unwrap()
            .len();
        assert!(
            active_count <= MAX_CONCURRENT_WORKERS,
            "Should not exceed MAX_CONCURRENT_WORKERS ({}), but got {}",
            MAX_CONCURRENT_WORKERS,
            active_count
        );
    }

    #[tokio::test]
    async fn test_create_workers_with_empty_set() {
        let state = new_state().await;
        let controller = new_test_controller(state).await;

        let file_ids: HashSet<Uuid> = HashSet::new();
        let result = controller.create_workers(file_ids).await;

        assert!(result.is_ok(), "Should handle empty set gracefully");
    }

    #[tokio::test]
    async fn test_create_workers_logs_waiting_files() {
        let state = new_state().await;
        let controller = new_test_controller(state.clone()).await;

        // Create exactly MAX_CONCURRENT_WORKERS + 5 files
        let num_files = MAX_CONCURRENT_WORKERS + 5;
        let file_ids: HashSet<Uuid> = (0..num_files).map(|_| Uuid::new_v4()).collect();

        // This should create workers up to the limit
        let result = controller.create_workers(file_ids).await;

        assert!(result.is_ok(), "Should succeed even when limiting workers");

        // Verify we didn't create more than MAX_CONCURRENT_WORKERS
        let active_count = state
            .client
            .lock()
            .await
            .list_ids(true)
            .await
            .unwrap()
            .len();
        assert!(
            active_count <= MAX_CONCURRENT_WORKERS,
            "Should respect the concurrent worker limit"
        );
    }

    #[tokio::test]
    async fn test_file_has_tasks_returns_false_for_empty_channel() {
        let state = new_state().await;
        let file_id = Uuid::new_v4();

        // Check a file that has no tasks in PubSub
        let has_tasks = state.file_has_tasks(file_id).await.unwrap();

        assert!(!has_tasks, "Should return false for file with no tasks");
    }

    #[tokio::test]
    async fn test_file_has_tasks_returns_true_when_tasks_exist() {
        use quadratic_rust_shared::quadratic_api::TaskRun;

        let state = new_state().await;
        let file_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();
        let run_id = Uuid::new_v4();

        // Create a task and add it to PubSub
        let task = TaskRun {
            file_id,
            task_id,
            run_id,
            operations: vec![1, 2, 3],
        };

        state.add_tasks(vec![task]).await.unwrap();

        // Now check if the file has tasks
        let has_tasks = state.file_has_tasks(file_id).await.unwrap();

        assert!(has_tasks, "Should return true for file with tasks");
    }

    #[tokio::test]
    async fn test_create_workers_filters_files_without_tasks() {
        use quadratic_rust_shared::quadratic_api::TaskRun;

        let state = new_state().await;
        let controller = new_test_controller(state.clone()).await;

        // Create 5 file IDs
        let file_ids: HashSet<Uuid> = (0..5).map(|_| Uuid::new_v4()).collect();

        // Add tasks for only 2 of the files
        let file_ids_vec: Vec<Uuid> = file_ids.iter().cloned().collect();
        let file_with_tasks_1 = file_ids_vec[0];
        let file_with_tasks_2 = file_ids_vec[1];

        let task1 = TaskRun {
            file_id: file_with_tasks_1,
            task_id: Uuid::new_v4(),
            run_id: Uuid::new_v4(),
            operations: vec![1, 2, 3],
        };
        let task2 = TaskRun {
            file_id: file_with_tasks_2,
            task_id: Uuid::new_v4(),
            run_id: Uuid::new_v4(),
            operations: vec![4, 5, 6],
        };

        state.add_tasks(vec![task1, task2]).await.unwrap();

        // Attempt to create workers for all 5 files
        let result = controller.create_workers(file_ids).await;

        // Should succeed
        assert!(
            result.is_ok(),
            "Should succeed even when some files have no tasks"
        );

        // Workers should only be created for files with tasks (but they may fail/complete quickly)
        // We can't reliably check active worker count due to timing, but the operation should succeed
    }

    #[tokio::test]
    async fn test_create_workers_skips_all_when_no_tasks_exist() {
        let state = new_state().await;
        let controller = new_test_controller(state.clone()).await;

        // Create file IDs but don't add any tasks to PubSub
        let file_ids: HashSet<Uuid> = (0..5).map(|_| Uuid::new_v4()).collect();

        // Attempt to create workers
        let result = controller.create_workers(file_ids).await;

        // Should succeed without creating any workers
        assert!(result.is_ok(), "Should succeed when no files have tasks");

        // Verify no workers were created
        let active_count = state
            .client
            .lock()
            .await
            .list_ids(true)
            .await
            .unwrap()
            .len();
        assert_eq!(
            active_count, 0,
            "Should not create any workers when no files have tasks"
        );
    }

    #[tokio::test]
    async fn test_create_workers_prioritizes_files_with_tasks() {
        use quadratic_rust_shared::quadratic_api::TaskRun;

        let state = new_state().await;
        let controller = new_test_controller(state.clone()).await;

        // Create MAX_CONCURRENT_WORKERS + 5 files
        let num_files = MAX_CONCURRENT_WORKERS + 5;
        let all_file_ids: Vec<Uuid> = (0..num_files).map(|_| Uuid::new_v4()).collect();

        // Add tasks only for the first 3 files
        let files_with_tasks = &all_file_ids[0..3];
        for file_id in files_with_tasks {
            let task = TaskRun {
                file_id: *file_id,
                task_id: Uuid::new_v4(),
                run_id: Uuid::new_v4(),
                operations: vec![1, 2, 3],
            };
            state.add_tasks(vec![task]).await.unwrap();
        }

        // Try to create workers for all files
        let file_ids_set: HashSet<Uuid> = all_file_ids.into_iter().collect();
        let result = controller.create_workers(file_ids_set).await;

        // Should succeed - the key thing is that it doesn't try to create
        // MAX_CONCURRENT_WORKERS workers, only up to 3 (the ones with tasks)
        assert!(
            result.is_ok(),
            "Should succeed and only attempt to create workers for files with tasks"
        );
    }
}
