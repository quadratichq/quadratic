use crate::{config::Config, state::State};
use anyhow::Result;
use quadratic_core_cloud::worker::Worker as Core;
use quadratic_rust_shared::quadratic_cloud::{
    ack_tasks, get_tasks, get_worker_access_token, get_worker_init_data, worker_shutdown,
};
use tracing::{error, info};

pub(crate) struct Worker {
    state: State,
    core: Core,
}

impl Worker {
    pub(crate) async fn new(config: Config) -> Result<Self> {
        let file_id = config.file_id;
        info!("File worker starting for file: {}", file_id);

        let worker_init_data = match get_worker_init_data(
            &config.controller_url,
            file_id,
            config.worker_ephemeral_token,
        )
        .await
        {
            Ok(worker_init_data) => worker_init_data,
            Err(e) => {
                error!("Error getting worker init data for file: {file_id}, error: {e}");
                return Err(anyhow::anyhow!(
                    "Error getting worker init data for file: {file_id}, error: {e}"
                ));
            }
        };
        info!("worker_init_data: {worker_init_data:?}",);

        let multiplayer_url = config.multiplayer_url.to_string();
        let state = match State::new(
            config,
            worker_init_data.worker_access_token.clone(),
            worker_init_data.team_id,
        ) {
            Ok(state) => state,
            Err(e) => {
                error!("Error creating state for file: {file_id}, error: {e}");
                return Err(e);
            }
        };

        let core = match Core::new(
            file_id,
            worker_init_data.sequence_number as u64,
            &worker_init_data.presigned_url,
            // worker_init_data.worker_access_token,
            "M2M_AUTH_TOKEN".to_string(),
            multiplayer_url,
        )
        .await
        {
            Ok(core) => core,
            Err(e) => {
                error!("Error creating core worker, error: {e}");
                return Err(anyhow::anyhow!("Error creating core worker, error: {e}"));
            }
        };

        Ok(Self { state, core })
    }

    pub(crate) async fn run(&mut self) -> Result<()> {
        loop {
            let tasks = get_tasks(
                &self.state.settings.controller_url,
                self.state.settings.file_id,
                self.state.settings.worker_ephemeral_token,
            )
            .await?;

            info!(
                "Got {} tasks for file {}",
                self.state.settings.file_id,
                tasks.len()
            );

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
                        // self.state.team_id,
                        // self.state.worker_access_token.clone(),
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

            match ack_tasks(
                &self.state.settings.controller_url,
                self.state.settings.file_id,
                self.state.settings.worker_ephemeral_token,
                successful_tasks,
                failed_tasks,
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

        Ok(())
    }

    pub(crate) async fn refresh_worker_access_token(&mut self) -> Result<()> {
        match get_worker_access_token(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
            self.state.settings.worker_ephemeral_token,
        )
        .await
        {
            Ok(worker_access_token) => {
                self.state.worker_access_token = worker_access_token.jwt.clone();
                Ok(())
            }
            Err(e) => {
                error!("Error getting worker access token, error: {e}");
                return Err(anyhow::anyhow!(
                    "Error getting worker access token, error: {e}"
                ));
            }
        }
    }

    pub(crate) async fn shutdown(&mut self) {
        info!("Worker shutting down");

        match self.core.leave_room().await {
            Ok(_) => {
                info!("Left room successfully");
            }
            Err(e) => {
                error!("Error leaving room, error: {e}");
            }
        }

        match worker_shutdown(
            &self.state.settings.controller_url,
            self.state.settings.file_id,
            self.state.settings.worker_ephemeral_token,
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
