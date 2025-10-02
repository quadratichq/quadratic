use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use futures::future::join_all;
use quadratic_rust_shared::docker::cluster::Cluster;
use tracing::{error, info};
use uuid::Uuid;

use crate::state::State;

pub(crate) struct Controller {
    pub(crate) state: Arc<State>,
}

impl Controller {
    pub(crate) async fn new(state: Arc<State>) -> Result<Self> {
        Ok(Self { state })
    }

    pub(crate) async fn scan_and_ensure_all_workers(&self) -> Result<()> {
        info!("[scan_and_ensure_all_workers] Scanning and ensuring all workers exist");

        let file_ids_needing_workers = self.state.get_file_ids_to_process().await?;

        info!(
            "[scan_and_ensure_all_workers] Found {} unique files with pending tasks",
            file_ids_needing_workers.len(),
        );

        self.ensure_workers_exist(file_ids_needing_workers).await?;

        Ok(())
    }

    async fn ensure_workers_exist(&self, file_ids: HashSet<Uuid>) -> Result<()> {
        info!(
            "[ensure_workers_exist] Ensuring workers exist for {} files",
            file_ids.len()
        );

        if file_ids.is_empty() {
            info!("[ensure_workers_exist] No files to ensure workers exist for, skipping");
            return Ok(());
        }

        let active_worker_file_ids = self.get_all_active_worker_file_ids().await?;

        info!(
            "[ensure_workers_exist] Found {} active file workers",
            active_worker_file_ids.len(),
        );

        let missing_workers = file_ids
            .into_iter()
            .filter(|file_id| !active_worker_file_ids.contains(file_id))
            .collect::<Vec<_>>();

        if missing_workers.is_empty() {
            info!("[ensure_workers_exist] No files are missing file workers, skipping");
            return Ok(());
        }

        info!(
            "[ensure_workers_exist] Found {} files that are missing file workers, creating them",
            missing_workers.len()
        );

        let futures = missing_workers
            .iter()
            .map(|file_id| self.create_worker(file_id));

        let results = join_all(futures).await;

        for (file_id, result) in missing_workers.into_iter().zip(results) {
            if let Err(e) = result {
                error!("[ensure_workers_exist] Failed to create file worker for {file_id}: {e}");
            }
        }

        Ok(())
    }

    async fn get_all_active_worker_file_ids(&self) -> Result<HashSet<Uuid>> {
        let active_file_ids = HashSet::new();

        Ok(active_file_ids)
    }

    async fn file_has_active_worker(&self, file_id: &Uuid) -> Result<bool> {
        info!("[file_has_active_worker] Checking if file {file_id} has an active worker");

        Ok(false)
    }

    async fn create_worker(&self, file_id: &Uuid) -> Result<()> {
        info!("[create_worker] Creating worker for file {file_id}");

        // Check if the file has an active worker
        if self.file_has_active_worker(file_id).await? {
            info!("File worker exists after lock for file {file_id}");
            self.state.release_worker_create_lock(file_id).await;
            return Ok(());
        }

        // Acquire the worker create lock
        let acquired = self.state.acquire_worker_create_lock(file_id).await;
        if !acquired {
            info!("Worker creation lock held for file {file_id}");
            return Ok(());
        }

        Ok(())
    }

    pub(crate) async fn shutdown_worker(state: &Arc<State>, file_id: &Uuid) -> Result<()> {
        info!("[shutdown_worker] Shutting down worker for file {file_id}");

        Ok(())
    }

    pub(crate) async fn count_active_workers(&self) -> Result<usize> {
        Ok(0)
    }
}
