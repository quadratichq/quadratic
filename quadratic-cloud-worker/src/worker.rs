use quadratic_core_cloud::worker::Worker as Core;
use quadratic_rust_shared::quadratic_api::TaskRun;
use quadratic_rust_shared::quadratic_cloud::{
    GetWorkerInitDataResponse, ack_tasks, worker_shutdown,
};
use std::time::Duration;
use tracing::{error, info};
use uuid::Uuid;

use crate::config::Config;
use crate::error::{Result, WorkerError};

pub(crate) struct Worker {
    core: Core,
    container_id: Uuid,
    file_id: Uuid,
    worker_init_data: GetWorkerInitDataResponse,
    m2m_auth_token: String,
    controller_url: String,
    tasks: Vec<(String, TaskRun)>,
}

impl Worker {
    pub(crate) async fn new(config: Config) -> Result<Self> {
        let file_id = config.file_id.to_owned();
        let container_id = config.container_id.to_owned();
        let worker_init_data = config.worker_init_data;
        let m2m_auth_token = config.m2m_auth_token.to_owned();
        let controller_url = config.controller_url.to_owned();
        let tasks = config.tasks;

        info!("File worker starting for file: {}", file_id);

        let core = Core::new(
            file_id,
            worker_init_data.sequence_number.to_owned() as u64,
            &worker_init_data.presigned_url.to_owned(),
            config.m2m_auth_token.to_owned(),
            config.multiplayer_url.to_owned(),
        )
        .await
        .map_err(|e| WorkerError::CreateWorker(e.to_string()))?;

        Ok(Self {
            core,
            container_id,
            file_id,
            worker_init_data,
            m2m_auth_token,
            controller_url,
            tasks,
        })
    }

    pub(crate) async fn run(&mut self) -> Result<()> {
        let container_id = self.container_id;
        let file_id = self.file_id;
        let team_id = self.worker_init_data.team_id.to_string();
        let controller_url = self.controller_url.to_owned();

        // swap the tasks in memory and replace with an empty vec
        let tasks = std::mem::take(&mut self.tasks);

        let mut successful_tasks = Vec::new();
        let mut failed_tasks = Vec::new();

        for (key, task) in tasks {
            match self
                .core
                .process_operations(
                    task.operations,
                    team_id.to_owned(),
                    self.m2m_auth_token.to_owned(),
                )
                .await
            {
                Ok(_) => successful_tasks.push((key, task.run_id, task.task_id)),
                Err(e) => {
                    error!("Error processing tasks, error: {e}");
                    failed_tasks.push((key, task.run_id, task.task_id, e.to_string()));
                }
            };
        }

        // wait for all tasks to be complete
        info!("Waiting for all tasks to be complete");
        while !self.core.status.lock().await.is_complete() {
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        let acked_tasks = ack_tasks(
            &controller_url,
            container_id,
            file_id,
            successful_tasks,
            failed_tasks,
        )
        .await
        .map_err(|e| WorkerError::AckTasks(e.to_string()));

        match acked_tasks {
            Ok(_) => info!("Tasks acknowledged successfully"),
            Err(e) => error!("Error acknowledging tasks, error: {e}"),
        }

        info!("Exiting run loop");

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
        worker_shutdown(&self.controller_url, self.container_id, self.file_id)
            .await
            .map_err(|e| WorkerError::Shutdown(e.to_string()))?;

        Ok(())
    }
}
