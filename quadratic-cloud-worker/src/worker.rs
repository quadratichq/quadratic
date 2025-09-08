use anyhow::Result;
use quadratic_rust_shared::quadratic_cloud::{
    GetTasksResponse, ack_tasks, get_last_checkpoint_data_url, get_tasks,
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

        let last_checkpoint_data_url = get_last_checkpoint_data_url(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
            self.state.settings.worker_token,
        )
        .await?;

        println!("last_checkpoint_data_url: {}", last_checkpoint_data_url);
        info!("last_checkpoint_data_url: {}", last_checkpoint_data_url);

        match get_tasks(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
            self.state.settings.worker_token,
        )
        .await
        {
            Ok(get_tasks_response) => match self.process_tasks(get_tasks_response).await {
                Ok(task_ids) => {
                    ack_tasks(
                        &self.state.settings.controller_url,
                        self.state.settings.file_id,
                        self.state.settings.worker_token,
                        task_ids,
                    )
                    .await?;
                }
                Err(e) => {
                    error!("Error processing tasks, error: {e}");
                }
            },
            Err(e) => {
                error!("Error getting tasks, error: {e}");
            }
        }

        Ok(())
    }

    async fn process_tasks(&self, get_tasks_response: GetTasksResponse) -> Result<Vec<Uuid>> {
        let task_ids = get_tasks_response.iter().map(|task| task.task_id).collect();

        println!("task_ids: {task_ids:?}");

        info!("task_ids: {task_ids:?}");

        Ok(task_ids)
    }
}
