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

        info!(
            "📋 Processing {} task(s) for file: {}",
            tasks.len(),
            file_id
        );

        for (key, task) in tasks {
            let task_start = std::time::Instant::now();
            info!(
                "⚙️  [Worker] Starting task {} (run_id: {}, task_id: {})",
                key, task.run_id, task.task_id
            );

            match self
                .core
                .process_operations(
                    task.operations,
                    team_id.to_owned(),
                    self.m2m_auth_token.to_owned(),
                )
                .await
            {
                Ok(_) => {
                    let elapsed = task_start.elapsed();
                    info!(
                        "✅ [Worker] Task {} completed successfully (duration: {:.2}ms)",
                        key,
                        elapsed.as_secs_f64() * 1000.0
                    );
                    successful_tasks.push((key, task.run_id, task.task_id));
                }
                Err(e) => {
                    let elapsed = task_start.elapsed();
                    error!(
                        "❌ [Worker] Task {} failed after {:.2}ms, error: {e}",
                        key,
                        elapsed.as_secs_f64() * 1000.0
                    );
                    failed_tasks.push((key, task.run_id, task.task_id, e.to_string()));
                }
            };
        }

        // wait for all tasks to be complete
        info!("⏳ [Worker] Waiting for all code executions to complete...");
        let mut wait_count = 0;
        while !self.core.status.lock().await.is_complete() {
            wait_count += 1;
            if wait_count % 5 == 0 {
                info!(
                    "⏳ [Worker] Still waiting for code executions... ({}s elapsed)",
                    wait_count
                );
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        info!("✅ [Worker] All code executions completed");

        // Store counts before moving the vectors
        let successful_count = successful_tasks.len();
        let failed_count = failed_tasks.len();

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
            Ok(_) => {
                info!(
                    "✅ [Worker] Tasks acknowledged successfully (successful: {}, failed: {})",
                    successful_count, failed_count
                );
            }
            Err(e) => error!("❌ [Worker] Error acknowledging tasks, error: {e}"),
        }

        Ok(())
    }

    pub(crate) async fn shutdown(&mut self) -> Result<()> {
        info!("🔄 Worker shutting down");

        // leave the multiplayer room
        match self.core.leave_room().await {
            Ok(_) => info!("✅ Successfully left multiplayer room"),
            Err(e) => {
                error!("⚠️  Error leaving multiplayer room: {}", e);
                // Continue with shutdown even if leaving room fails
            }
        }

        // send worker shutdown request to the controller
        match worker_shutdown(&self.controller_url, self.container_id, self.file_id).await {
            Ok(_) => info!("✅ Successfully notified controller of shutdown"),
            Err(e) => {
                error!("⚠️  Error notifying controller of shutdown: {}", e);
                // Don't fail shutdown if controller notification fails
            }
        }

        info!("✅ Worker shutdown complete");
        Ok(())
    }
}
