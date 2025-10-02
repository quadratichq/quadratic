//! Container
//!
//! Functions to interact with a Docker container

use std::fmt::Display;
use std::sync::Arc;

pub use bollard::Docker;
use bollard::models::ContainerCreateBody;
use bollard::query_parameters::{
    CreateContainerOptions, LogsOptions, RemoveContainerOptions, StartContainerOptions,
    StopContainerOptions,
};
use futures_util::StreamExt;
use strum_macros::Display;
use tokio::sync::Mutex;

use crate::{
    docker::error::Docker as DockerError,
    error::{Result, SharedError},
};

#[derive(Debug, Display, Clone)]
pub enum ContainerState {
    Running,
    Stopped,
    Removed,
}

#[derive(Debug)]
pub struct Container {
    pub(crate) id: String,
    pub(crate) image: String,
    pub(crate) docker: Arc<Mutex<Docker>>,
    pub(crate) state: ContainerState,
}

impl Display for Container {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            r#"Container(image: {}, id: {}, state: {})"#,
            self.image, self.id, self.state
        )
    }
}

impl Container {
    /// Create a new container
    pub async fn try_new(
        image: &str,
        docker: Arc<Mutex<Docker>>,
        env_vars: Option<Vec<String>>,
        cmd: Option<Vec<String>>,
    ) -> Result<Self> {
        let create_options = CreateContainerOptions {
            name: Some(format!("{}-{}", image, uuid::Uuid::new_v4())),
            ..Default::default()
        };

        let config = ContainerCreateBody {
            image: Some(image.to_string()),
            env: env_vars,
            cmd: cmd,
            ..Default::default()
        };

        let container = docker
            .lock()
            .await
            .create_container(Some(create_options), config)
            .await
            .map_err(Self::error)?;

        Ok(Self {
            id: container.id,
            image: image.to_string(),
            docker: Arc::clone(&docker),
            state: ContainerState::Stopped,
        })
    }

    /// Start the container
    pub async fn start(&mut self) -> Result<()> {
        let start_options = StartContainerOptions { detach_keys: None };
        self.docker
            .lock()
            .await
            .start_container(&self.id, Some(start_options))
            .await
            .map_err(Self::error)?;

        self.state = ContainerState::Running;

        Ok(())
    }

    /// Stop the container
    pub async fn stop(&mut self) -> Result<()> {
        self.docker
            .lock()
            .await
            .stop_container(&self.id, None::<StopContainerOptions>)
            .await
            .map_err(Self::error)?;

        self.state = ContainerState::Stopped;

        Ok(())
    }

    /// Remove the container
    pub async fn remove(&mut self) -> Result<()> {
        self.docker
            .lock()
            .await
            .remove_container(&self.id, None::<RemoveContainerOptions>)
            .await
            .map_err(Self::error)?;

        self.state = ContainerState::Removed;

        Ok(())
    }

    /// Get the logs from the container
    pub async fn logs(&self) -> Result<String> {
        let options = LogsOptions {
            stdout: true,
            stderr: true,
            ..Default::default()
        };
        let mut logs_stream = self.docker.lock().await.logs(&self.id, Some(options));
        let mut logs = String::new();

        while let Some(log_result) = logs_stream.next().await {
            let log_output = log_result.map_err(Self::error)?;
            logs.push_str(&log_output.to_string());
        }

        Ok(logs)
    }

    /// Get the state of the container
    pub fn state(&self) -> ContainerState {
        self.state.clone()
    }

    /// Error helper
    fn error(error: impl ToString) -> SharedError {
        SharedError::Docker(DockerError::Container(error.to_string()))
    }
}

#[cfg(test)]
pub mod tests {
    use std::sync::Arc;

    use tokio::sync::Mutex;

    use super::*;

    pub async fn new_container(docker: Arc<Mutex<Docker>>) -> Arc<Mutex<Container>> {
        let env_vars = vec![
            format!("CONTROLLER_URL={}", "http://localhost:8080"),
            format!("FILE_ID={}", "550e8400-e29b-41d4-a716-446655440000"),
            format!(
                "WORKER_EPHEMERAL_TOKEN={}",
                "550e8400-e29b-41d4-a716-446655440001"
            ),
        ];

        let container = Container::try_new(
            "quadratic-cloud-worker",
            docker.clone(),
            Some(env_vars),
            None,
        )
        .await
        .unwrap();
        let container = Arc::new(Mutex::new(container));

        container
    }

    #[tokio::test]
    async fn test_container() {
        let docker = Docker::connect_with_socket_defaults().unwrap();
        let docker = Arc::new(Mutex::new(docker));
        let container = new_container(docker.clone()).await;

        // in a separate thread, print the logs every second
        let log_container = container.clone();
        tokio::spawn(async move {
            loop {
                println!("Logs: {}", log_container.lock().await.logs().await.unwrap());
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        });

        println!("Created worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.start().await.unwrap();

        println!("Started worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.stop().await.unwrap();

        println!("Stopped worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.remove().await.unwrap();

        println!("Removed worker: {}", container.lock().await);
    }
}
