use std::collections::HashSet;
use std::sync::Arc;

use futures::future::join_all;
use quadratic_rust_shared::docker::container::Container;
use tracing::{error, info, trace};
use uuid::Uuid;

use crate::{
    error::{ControllerError, Result},
    state::State,
};

pub(crate) const IMAGE_NAME: &str = "quadratic-cloud-worker";
const DEFAULT_TIMEOUT_SECONDS: i64 = 60;

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

    pub(crate) async fn create_workers(&self, file_ids: HashSet<Uuid>) -> Result<()> {
        trace!("Creating workers for {} files", file_ids.len());

        if file_ids.is_empty() {
            trace!("No files to create workers for, skipping");
            return Ok(());
        }

        let existing_workers = self.get_all_active_worker_file_ids().await?;
        let workers_needed = file_ids
            .into_iter()
            .filter(|file_id| !existing_workers.contains(file_id))
            .collect::<HashSet<_>>();

        let workers = workers_needed
            .iter()
            .map(|file_id| self.create_worker(file_id));
        let results = join_all(workers).await;

        for (file_id, result) in workers_needed.into_iter().zip(results) {
            if let Err(e) = result {
                error!("Failed to create file worker for {file_id}: {e}");
            }
        }

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
            .list_ids()
            .await
            .map_err(|e| Self::error("get_all_active_worker_file_ids", e))?
            .into_iter()
            .collect::<HashSet<_>>();

        Ok(active_file_ids)
    }

    async fn file_has_active_worker(&self, file_id: &Uuid) -> Result<bool> {
        let has_container = self
            .state
            .client
            .lock()
            .await
            .has_container(file_id)
            .await
            .map_err(|e| Self::error("file_has_active_worker", e))?;

        trace!("File {file_id} has an active worker: {has_container}");

        Ok(has_container)
    }

    pub(crate) async fn create_worker(&self, file_id: &Uuid) -> Result<()> {
        trace!("Creating worker for file {file_id}");

        // Check if the file has an active worker
        if self.file_has_active_worker(file_id).await? {
            trace!("File worker exists after lock for file {file_id}");
            self.state.release_worker_create_lock(file_id).await;
            // return Ok(());
        }

        // Acquire the worker create lock
        let acquired = self.state.acquire_worker_create_lock(file_id).await;
        if !acquired {
            trace!("Worker creation lock held for file {file_id}");
            return Ok(());
        }

        let controller_port = self.state.settings.worker_only_port.to_string();
        let controller_host = self.state.settings.worker_internal_host.to_string();
        let multiplayer_port = self.state.settings.multiplayer_port.to_string();
        let multiplayer_host = self.state.settings.multiplayer_host.to_string();
        let env_vars = vec![
            format!("RUST_LOG={}", "info"), // change this to info for seeing all logs
            format!(
                "CONTROLLER_URL={}",
                format!("http://{controller_host}:{controller_port}")
            ),
            format!(
                "MULTIPLAYER_URL={}",
                format!("ws://{multiplayer_host}:{multiplayer_port}/ws")
            ),
            format!("FILE_ID={}", file_id.to_string()),
        ];

        let container = Container::try_new(
            *file_id,
            &self.image_name,
            self.state.client.lock().await.docker.clone(),
            Some(env_vars),
            None,
            Some(DEFAULT_TIMEOUT_SECONDS),
        )
        .await
        .map_err(|e| Self::error("create_worker", e))?;

        self.state
            .client
            .lock()
            .await
            .add_container(container, true)
            .await
            .map_err(|e| Self::error("create_worker", e))?;

        info!("Added worker for file {file_id}");

        Ok(())
    }

    pub(crate) async fn shutdown_worker(state: Arc<State>, file_id: &Uuid) -> Result<()> {
        tracing::warn!("shutdown_worker 1");
        let mut client = state.client.lock().await;
        tracing::warn!("shutdown_worker 2");
        client
            .remove_container(file_id)
            .await
            .map_err(|e| Self::error("shutdown_worker", e))?;
        tracing::warn!("shutdown_worker 3");
        state.release_worker_create_lock(file_id).await;

        info!("Shut down worker for file {file_id}");
        tracing::warn!("shutdown_worker 4");

        Ok(())
    }

    pub(crate) async fn count_active_workers(&self) -> Result<usize> {
        let active_file_ids = self.get_all_active_worker_file_ids().await?;
        Ok(active_file_ids.len())
    }

    fn error(func_name: &str, error: impl ToString) -> ControllerError {
        ControllerError::Docker(format!("{func_name}: {}", error.to_string()))
    }
}
