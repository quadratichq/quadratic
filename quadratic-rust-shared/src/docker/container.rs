//! Container
//!
//! Functions to interact with a Docker container

use std::fmt::Display;

pub use bollard::Docker;
use bollard::models::{ContainerCreateBody, HostConfig};
use bollard::query_parameters::{
    CreateContainerOptions, LogsOptions, RemoveContainerOptions, StartContainerOptions,
    StopContainerOptions,
};
use futures_util::{Stream, StreamExt};
use strum_macros::Display;
use uuid::Uuid;

use crate::{
    docker::error::Docker as DockerError,
    error::{Result, SharedError},
};

#[derive(Debug, Display, Clone, PartialEq)]
pub enum ContainerState {
    Running,
    Stopped,
    Removed,
}

#[derive(Debug)]
pub struct Container {
    pub(crate) id: Uuid,
    pub(crate) image_id: String,
    pub(crate) image: String,
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
        id: Uuid,
        image: &str,
        docker: Docker,
        env_vars: Option<Vec<String>>,
        cmd: Option<Vec<String>>,
    ) -> Result<Self> {
        let create_options = CreateContainerOptions {
            name: Some(format!("{}-{}", image, id)),
            ..Default::default()
        };

        let host_config = HostConfig {
            extra_hosts: Some(vec!["host.docker.internal:host-gateway".to_string()]),
            ..Default::default()
        };

        let config = ContainerCreateBody {
            image: Some(image.to_string()),
            env: env_vars,
            cmd: cmd,
            host_config: Some(host_config),
            ..Default::default()
        };

        let container = docker
            .create_container(Some(create_options), config)
            .await
            .map_err(Self::error)?;

        Ok(Self {
            id,
            image_id: container.id,
            image: image.to_string(),
            state: ContainerState::Stopped,
        })
    }

    /// Start the container
    pub async fn start(&mut self, docker: Docker) -> Result<()> {
        let start_options = StartContainerOptions { detach_keys: None };
        docker
            .start_container(&self.image_id, Some(start_options))
            .await
            .map_err(Self::error)?;

        self.state = ContainerState::Running;

        Ok(())
    }

    /// Stop the container
    pub async fn stop(&mut self, docker: &mut Docker) -> Result<()> {
        let options = StopContainerOptions {
            t: Some(1),
            ..Default::default()
        };

        docker
            .stop_container(&self.image_id, Some(options))
            .await
            .map_err(Self::error)?;

        self.state = ContainerState::Stopped;

        Ok(())
    }

    /// Remove the container
    pub async fn remove(&mut self, docker: &mut Docker) -> Result<()> {
        let options = RemoveContainerOptions {
            force: true,
            ..Default::default()
        };

        docker
            .remove_container(&self.image_id, Some(options))
            .await
            .map_err(Self::error)?;

        self.state = ContainerState::Removed;

        Ok(())
    }

    /// Get the logs from the container
    pub async fn logs(&self, docker: Docker) -> Result<String> {
        let mut logs_stream = self.logs_stream(docker).await?;
        let mut logs = String::new();

        while let Some(log_result) = logs_stream.next().await {
            let log_output = log_result.map_err(Self::error)?;
            logs.push_str(&log_output.to_string());
        }

        Ok(logs)
    }

    /// Get the stream of logs from the container
    pub async fn logs_stream(
        &self,
        docker: Docker,
    ) -> Result<
        impl Stream<Item = std::result::Result<bollard::container::LogOutput, bollard::errors::Error>>,
    > {
        let options = LogsOptions {
            stdout: true,
            stderr: true,
            ..Default::default()
        };
        let logs_stream = docker.logs(&self.image_id, Some(options));

        Ok(logs_stream)
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

    pub async fn new_container(docker: Docker) -> Container {
        let env_vars = vec![
            format!("CONTROLLER_URL={}", "http://host.docker.internal:3005"),
            format!("MULTIPLAYER_URL={}", "ws://host.docker.internal:3001/ws"),
            format!("FILE_ID={}", "ae08a585-dd3a-4c90-8628-156cdebd21c4"),
            format!(
                "WORKER_EPHEMERAL_TOKEN={}",
                "550e8400-e29b-41d4-a716-446655440001"
            ),
        ];

        let container = Container::try_new(
            Uuid::new_v4(),
            "quadratic-cloud-worker",
            docker.clone(),
            Some(env_vars),
            None,
        )
        .await
        .unwrap();

        container
    }

    #[tokio::test]
    async fn test_container() {
        let mut docker = Docker::connect_with_socket_defaults().unwrap();
        let container = Arc::new(Mutex::new(new_container(docker.clone()).await));

        // in a separate thread, print the logs every second
        let log_container = Arc::clone(&container);
        let log_docker = docker.clone();
        tokio::spawn(async move {
            loop {
                if let Ok(logs) = log_container.lock().await.logs(log_docker.clone()).await {
                    println!("Logs: {}", logs);
                }

                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        });

        println!("Created worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.start(docker.clone()).await.unwrap();

        println!("Started worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.stop(&mut docker).await.unwrap();

        println!("Stopped worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.remove(&mut docker).await.unwrap();

        println!("Removed worker: {}", container.lock().await);
    }
}
