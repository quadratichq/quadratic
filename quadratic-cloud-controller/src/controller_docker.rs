use std::collections::HashSet;
use std::sync::Arc;

use futures::future::join_all;
use quadratic_rust_shared::{
    docker::container::Container,
    quadratic_cloud::{GetWorkerInitDataResponse, compress_tasks, encode_tasks},
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

        let workers = file_ids.iter().map(|file_id| self.create_worker(*file_id));
        let results = join_all(workers).await;

        info!("Results: {:?}", results);

        for (file_id, result) in file_ids.into_iter().zip(results) {
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

    async fn _get_all_active_worker_file_ids(&self) -> Result<HashSet<Uuid>> {
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

        trace!("[File init data for file {file_id}: {file_init_data:?}");

        let worker_init_data = GetWorkerInitDataResponse {
            team_id: file_init_data.team_id,
            sequence_number: file_init_data.sequence_number,
            presigned_url: file_init_data.presigned_url,
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

        info!(
            "Got tasks for worker for file {file_id} for binary tasks: {:?}",
            tasks
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
            info!("No tasks to create worker for file {file_id}");
            return Ok(());
        }

        let container_id = Uuid::new_v4();
        let container_name = format!("quadratic-cron-{file_id}-{container_id}");
        let controller_url = self.state.settings.controller_url();
        let multiplayer_url = self.state.settings.multiplayer_url();
        let m2m_auth_token = self.state.settings.m2m_auth_token.to_owned();
        let worker_init_data = self.get_worker_init_data(&file_id).await?;
        let worker_init_data_json = serde_json::to_string(&worker_init_data)?;

        let encoded_tasks = encode_tasks(tasks).map_err(|e| Self::error("create_worker", e))?;

        let env_vars = vec![
            format!("RUST_LOG={}", "info"), // change this to info for seeing all logs
            format!("CONTAINER_ID={container_id}"),
            format!("CONTROLLER_URL={controller_url}"),
            format!("MULTIPLAYER_URL={multiplayer_url}"),
            format!("FILE_ID={file_id}"),
            format!("M2M_AUTH_TOKEN={m2m_auth_token}"),
            format!("TASKS={}", encoded_tasks),
            format!("WORKER_INIT_DATA={}", worker_init_data_json),
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

    #[tokio::test]
    async fn test_create_worker() {
        let state = new_state().await;
        let controller = Controller::new(state).await.unwrap();
        let file_id = Uuid::new_v4();
        controller.create_worker(file_id).await.unwrap();
    }
}
