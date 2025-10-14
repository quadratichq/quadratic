use quadratic_core_cloud::worker::Worker as Core;
use quadratic_rust_shared::quadratic_cloud::{
    ack_tasks, get_tasks, get_worker_init_data, worker_shutdown,
};
use std::time::Duration;
use tracing::{error, info};

use crate::config::Config;
use crate::error::{Result, WorkerError};
use crate::state::State;

pub(crate) struct Worker {
    state: State,
    core: Core,
}

impl Worker {
    pub(crate) async fn new(config: Config) -> Result<Self> {
        let state = State::new(config.clone());
        let file_id = config.file_id;
        let controller_url = config.controller_url;
        let multiplayer_url = config.multiplayer_url;

        info!("File worker starting for file: {}", file_id);

        let worker_init_data = get_worker_init_data(&controller_url, file_id)
            .await
            .map_err(|e| WorkerError::InitData(e.to_string()))?;

        info!("worker_init_data: {worker_init_data:?}",);

        let core = Core::new(
            file_id,
            worker_init_data.sequence_number as u64,
            &worker_init_data.presigned_url,
            // worker_init_data.worker_access_token,
            "M2M_AUTH_TOKEN".to_string(),
            multiplayer_url,
        )
        .await
        .map_err(|e| WorkerError::CreateWorker(e.to_string()))?;

        Ok(Self { state, core })
    }

    pub(crate) async fn run(&mut self) -> Result<()> {
        let controller_url = self.state.settings.controller_url.to_owned();
        let file_id = self.state.settings.file_id;

        loop {
            let tasks = get_tasks(&controller_url, file_id)
                .await
                .map_err(|e| WorkerError::GetTasks(e.to_string()))?;

            info!("Got {} tasks for file {}", file_id, tasks.len());

            if tasks.is_empty() {
                break;
            }

            let mut successful_tasks = Vec::new();
            let mut failed_tasks = Vec::new();

            for (key, task) in tasks {
                match self
                    .core
                    .process_operations(
                        task.operations,
                        "test_team_id".to_string(),
                        "M2M_AUTH_TOKEN".to_string(),
                    )
                    .await
                {
                    Ok(_) => successful_tasks.push((key, task.task_id)),
                    Err(e) => {
                        error!("Error processing tasks, error: {e}");
                        failed_tasks.push((key, task.task_id, e.to_string()));
                    }
                };
            }

            // wait for all tasks to be complete
            while !self.core.status.lock().await.is_complete() {
                tokio::time::sleep(Duration::from_secs(1)).await;
            }

            let acked_tasks = ack_tasks(&controller_url, file_id, successful_tasks, failed_tasks)
                .await
                .map_err(|e| WorkerError::AckTasks(e.to_string()));

            match acked_tasks {
                Ok(_) => info!("Tasks acknowledged successfully"),
                Err(e) => error!("Error acknowledging tasks, error: {e}"),
            }
        }

        Ok(())
    }

    pub(crate) async fn shutdown(&mut self) -> Result<()> {
        info!("Worker shutting down");

        // leave the multiplayer room
        self.core
            .leave_room()
            .await
            .map_err(|e| WorkerError::LeaveRoom(e.to_string()))?;

        // send worker shutdown request to the controller
        worker_shutdown(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
        )
        .await
        .map_err(|e| WorkerError::Shutdown(e.to_string()))?;

        Ok(())
    }
}
