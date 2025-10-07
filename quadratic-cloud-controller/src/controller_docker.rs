use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use chrono::Utc;
use futures::future::join_all;
use quadratic_rust_shared::docker::container::Container;
use tokio::sync::Mutex;
use tracing::{error, info, trace};
use uuid::Uuid;

use crate::state::State;

pub(crate) const IMAGE_NAME: &str = "quadratic-cloud-worker";

pub(crate) struct Controller {
    pub(crate) state: Arc<State>,
}

impl Controller {
    pub(crate) async fn new(state: Arc<State>) -> Result<Self> {
        Ok(Self { state })
    }

    pub(crate) async fn scan_and_ensure_all_workers(&self) -> Result<()> {
        trace!("Scanning and ensuring all workers exist");

        let file_ids_needing_workers = self.state.get_file_ids_to_process().await?;

        trace!(
            "Found {} unique files with pending tasks",
            file_ids_needing_workers.len(),
        );

        self.ensure_workers_exist(file_ids_needing_workers).await?;

        Ok(())
    }

    async fn ensure_workers_exist(&self, file_ids: HashSet<Uuid>) -> Result<()> {
        trace!("Ensuring workers exist for {} files", file_ids.len());

        if file_ids.is_empty() {
            trace!("No files to ensure workers exist for, skipping");
            return Ok(());
        }

        let active_worker_file_ids = self.get_all_active_worker_file_ids().await?;

        trace!("Found {} active file workers", active_worker_file_ids.len(),);

        let missing_workers = file_ids
            .into_iter()
            .filter(|file_id| !active_worker_file_ids.contains(file_id))
            .collect::<Vec<_>>();

        if missing_workers.is_empty() {
            trace!("No files are missing file workers, skipping");
            return Ok(());
        }

        trace!(
            "Found {} files that are missing file workers, creating them",
            missing_workers.len()
        );

        let futures = missing_workers
            .iter()
            .map(|file_id| self.create_worker(file_id));

        let results = join_all(futures).await;

        for (file_id, result) in missing_workers.into_iter().zip(results) {
            if let Err(e) = result {
                error!("Failed to create file worker for {file_id}: {e}");
            }
        }

        Ok(())
    }

    async fn get_all_active_worker_file_ids(&self) -> Result<HashSet<Uuid>> {
        let active_file_ids = self
            .state
            .client
            .lock()
            .await
            .list_ids()
            .await?
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
            .has_container(&file_id)
            .await?;

        trace!("File {file_id} has an active worker: {has_container}");

        Ok(has_container)
    }

    async fn create_worker(&self, file_id: &Uuid) -> Result<()> {
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

        let env_vars = vec![
            format!("CONTROLLER_URL={}", "http://host.docker.internal:3005"),
            format!("MULTIPLAYER_URL={}", "ws://host.docker.internal:3001/ws"),
            format!("FILE_ID={}", file_id.to_string()),
            format!(
                "WORKER_EPHEMERAL_TOKEN={}",
                self.state.generate_worker_ephemeral_token(file_id).await,
            ),
        ];

        let container = Container::try_new(
            *file_id,
            IMAGE_NAME,
            self.state.client.lock().await.docker.clone(),
            Some(env_vars),
            None,
        )
        .await?;

        self.state
            .client
            .lock()
            .await
            .add_container(container, true)
            .await?;

        info!("Added worker for file {file_id}");

        Ok(())
    }

    pub(crate) async fn shutdown_worker(state: Arc<State>, file_id: &Uuid) -> Result<()> {
        let mut client = state.client.lock().await;
        client.remove_container(&file_id).await?;
        state.release_worker_create_lock(&file_id).await;

        trace!("Shut down worker for file {file_id}");

        Ok(())
    }

    pub(crate) async fn count_active_workers(&self) -> Result<usize> {
        let active_file_ids = self.get_all_active_worker_file_ids().await?;
        Ok(active_file_ids.len())
    }
}
