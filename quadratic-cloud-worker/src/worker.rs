use anyhow::Result;
use quadratic_rust_shared::quadratic_cloud::{
    GetTasksResponse, ack_tasks, get_last_file_checkpoint, get_tasks, worker_shutdown,
};
use tracing::{error, info};
use uuid::Uuid;

use crate::state::State;

pub struct Worker {
    state: State,
}

impl Worker {
    pub async fn new() -> Result<Self> {
        match State::new() {
            Ok(state) => Ok(Self { state }),
            Err(e) => {
                error!("Error creating state, error: {e}");
                Err(e)
            }
        }
    }

    pub async fn run(&self) -> Result<()> {
        info!(
            "File worker starting for file: {}",
            self.state.settings.file_id
        );

        let last_file_checkpoint = match get_last_file_checkpoint(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
            self.state.settings.worker_token,
        )
        .await
        {
            Ok(last_file_checkpoint) => last_file_checkpoint,
            Err(e) => {
                error!("Error getting last file checkpoint, error: {e}");
                self.shutdown().await;
                return Err(anyhow::anyhow!(
                    "Error getting last file checkpoint, error: {e}"
                ));
            }
        };

        info!(
            "last_file_checkpoint: {}, {}",
            last_file_checkpoint.presigned_url, last_file_checkpoint.sequence_number
        );

        loop {
            match get_tasks(
                &self.state.settings.controller_url,
                self.state.settings.file_id,
                self.state.settings.worker_token,
            )
            .await
            {
                Ok(get_tasks_response) => {
                    if get_tasks_response.is_empty() {
                        info!(
                            "No more tasks available for file: {}, shutting down",
                            self.state.settings.file_id
                        );
                        break;
                    }

                    match self.process_tasks(get_tasks_response).await {
                        Ok(task_ids) => {
                            match ack_tasks(
                                &self.state.settings.controller_url,
                                self.state.settings.file_id,
                                self.state.settings.worker_token,
                                task_ids,
                            )
                            .await
                            {
                                Ok(_) => {
                                    info!("Tasks acknowledged successfully");
                                }
                                Err(e) => {
                                    error!("Error acknowledging tasks, error: {e}");
                                    break;
                                }
                            }
                        }
                        Err(e) => {
                            error!("Error processing tasks, error: {e}");
                            break;
                        }
                    }
                }
                Err(e) => {
                    error!("Error getting tasks, error: {e}");
                    break;
                }
            }
        }

        self.shutdown().await;

        Ok(())
    }

    async fn process_tasks(&self, get_tasks_response: GetTasksResponse) -> Result<Vec<Uuid>> {
        let task_ids = get_tasks_response.iter().map(|task| task.task_id).collect();

        info!("Processing tasks: task_ids: {task_ids:?}");

        Ok(task_ids)
    }

    async fn shutdown(&self) {
        info!("Worker shutting down");

        match worker_shutdown(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
            self.state.settings.worker_token,
        )
        .await
        {
            Ok(shutdown_response) => {
                if shutdown_response.success {
                    info!("Worker shut down successfully");
                } else {
                    error!("Error shutting down, error: success is false");
                }
            }
            Err(e) => {
                error!("Error shutting down, error: {e}");
            }
        };
    }
}
