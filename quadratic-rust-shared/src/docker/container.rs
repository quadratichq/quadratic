//! Container
//!
//! Functions to interact with a Docker container

use std::fmt::Display;

pub use bollard::Docker;
use bollard::models::{ContainerCreateBody, HostConfig};
use bollard::query_parameters::{
    CreateContainerOptions, CreateImageOptions, InspectContainerOptions, ListImagesOptions,
    LogsOptions, RemoveContainerOptions, StartContainerOptions, StatsOptions, StopContainerOptions,
};
use chrono::{DateTime, Utc};
use futures_util::{Stream, StreamExt};
use strum_macros::Display;
use uuid::Uuid;

use crate::{
    docker::error::Docker as DockerError,
    error::{Result, SharedError},
};

const DEFAULT_TIMEOUT_SECONDS: i64 = 60;

#[derive(Debug, Display, Clone, PartialEq)]
pub enum ContainerState {
    Running,
    Stopped,
    Removed,
}

#[derive(Debug)]
pub struct Container {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) ids: Vec<(Uuid, Uuid)>,
    pub(crate) image_id: String,
    pub(crate) image: String,
    pub(crate) state: ContainerState,
    pub(crate) timeout_seconds: i64,
    pub start_time: DateTime<Utc>,
    pub cpu_usage: f64,
    pub memory_usage: u64,
}

impl Display for Container {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            r#"Container(image: {}, id: {}, file_id: {}, ids: {:?}, image_id: {}, state: {}, timeout_seconds: {}, start_time: {}, cpu_usage: {}, memory_usage: {})"#,
            self.image,
            self.id,
            self.file_id,
            self.ids,
            self.image_id,
            self.state,
            self.timeout_seconds,
            self.start_time,
            self.cpu_usage,
            self.memory_usage,
        )
    }
}

impl Container {
    /// Create a new container
    #[allow(clippy::too_many_arguments)]
    pub async fn try_new(
        id: Uuid,
        file_id: Uuid,
        ids: Vec<(Uuid, Uuid)>,
        image: &str,
        docker: Docker,
        container_name: Option<String>,
        env_vars: Option<Vec<String>>,
        cmd: Option<Vec<String>>,
        timeout_seconds: Option<i64>,
        binds: Option<Vec<String>>,
    ) -> Result<Self> {
        // Pull the image if it doesn't exist locally
        Self::pull_image_if_needed(&docker, image).await?;

        let container_name = container_name.unwrap_or(Self::image_basename(image));

        let create_options = CreateContainerOptions {
            name: Some(container_name),
            ..Default::default()
        };

        let host_config = HostConfig {
            extra_hosts: Some(vec!["host.docker.internal:host-gateway".to_string()]),
            binds,
            auto_remove: Some(true), // Automatically remove container when it exits
            ..Default::default()
        };

        let config = ContainerCreateBody {
            image: Some(image.to_string()),
            env: env_vars,
            cmd,
            host_config: Some(host_config),
            ..Default::default()
        };

        let create_container = docker
            .create_container(Some(create_options), config)
            .await
            .map_err(Self::error)?;

        Ok(Self {
            id,
            file_id,
            ids,
            image_id: create_container.id,
            image: image.to_string(),
            state: ContainerState::Stopped,
            timeout_seconds: timeout_seconds.unwrap_or(DEFAULT_TIMEOUT_SECONDS),
            start_time: Utc::now(),
            cpu_usage: 0.0,
            memory_usage: 0,
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
            follow: true,
            tail: "0".to_string(),
            ..Default::default()
        };
        let logs_stream = docker.logs(&self.image_id, Some(options));

        Ok(logs_stream)
    }

    /// Get the state of the container
    pub fn state(&self) -> ContainerState {
        self.state.clone()
    }

    /// Get the image ID of the container
    pub fn image_id(&self) -> &str {
        &self.image_id
    }

    /// Get the total runtime of the container in milliseconds
    pub fn total_runtime(&self) -> u128 {
        Utc::now()
            .signed_duration_since(self.start_time)
            .to_std()
            .unwrap_or_default()
            .as_millis()
    }

    /// Check if the container should be stopped
    pub fn should_stop(&self) -> bool {
        self.total_runtime() > self.timeout_seconds as u128 * 1000
    }

    /// Inspect the container to get detailed information including ResourceObject
    pub async fn inspect(
        &self,
        docker: Docker,
    ) -> Result<bollard::models::ContainerInspectResponse> {
        docker
            .inspect_container(&self.image_id, None::<InspectContainerOptions>)
            .await
            .map_err(Self::error)
    }

    /// Get the ResourceObject information from the container (configured limits)
    pub async fn get_resource_info(
        &self,
        docker: Docker,
    ) -> Result<Option<(Option<i64>, Option<i64>)>> {
        let inspect_result = self.inspect(docker).await?;

        if let Some(host_config) = inspect_result.host_config {
            Ok(Some((host_config.nano_cpus, host_config.memory)))
        } else {
            Ok(None)
        }
    }

    /// Get actual resource usage statistics from the container
    pub async fn get_resource_usage(&self, docker: Docker) -> Result<Option<(f64, u64)>> {
        let stats_options = StatsOptions {
            stream: false,
            one_shot: true,
        };

        let mut stats_stream = docker.stats(&self.image_id, Some(stats_options));

        if let Some(stats_result) = stats_stream.next().await {
            let stats = stats_result.map_err(Self::error)?;

            // Calculate CPU usage percentage
            let cpu_usage = stats
                .cpu_stats
                .as_ref()
                .zip(stats.precpu_stats.as_ref())
                .and_then(|(cpu_stats, precpu_stats)| {
                    let cpu_usage = cpu_stats.cpu_usage.as_ref()?.total_usage?;
                    let system_usage = cpu_stats.system_cpu_usage?;
                    let precpu_usage = precpu_stats.cpu_usage.as_ref()?.total_usage?;
                    let presystem_usage = precpu_stats.system_cpu_usage?;

                    let cpu_delta = cpu_usage.saturating_sub(precpu_usage) as f64;
                    let system_delta = system_usage.saturating_sub(presystem_usage) as f64;
                    let online_cpus = cpu_stats.online_cpus.unwrap_or(1) as f64;

                    (system_delta > 0.0).then(|| (cpu_delta / system_delta) * online_cpus * 100.0)
                })
                .unwrap_or(0.0);

            // Get memory usage
            let memory_usage = stats
                .memory_stats
                .as_ref()
                .and_then(|mem| mem.usage)
                .unwrap_or(0);

            Ok(Some((cpu_usage, memory_usage)))
        } else {
            Ok(None)
        }
    }

    /// Record the max resource usage in the container.
    pub async fn record_resource_usage(&mut self, docker: Docker) -> Result<()> {
        if let Ok(Some(resource_usage)) = self.get_resource_usage(docker).await {
            self.cpu_usage = self.cpu_usage.max(resource_usage.0);
            self.memory_usage = self.memory_usage.max(resource_usage.1);
        }

        Ok(())
    }

    /// Pull a Docker image if it doesn't exist locally
    async fn pull_image_if_needed(docker: &Docker, image: &str) -> Result<()> {
        // Check if image exists locally
        let images = docker
            .list_images(Some(ListImagesOptions {
                all: true,
                ..Default::default()
            }))
            .await
            .map_err(Self::error)?;

        let image_exists = images.iter().any(|img| {
            img.repo_tags
                .iter()
                .any(|tag| tag == image || tag.starts_with(&format!("{}:", image)))
        });

        if !image_exists {
            tracing::info!("Pulling Docker image: {}", image);

            let options = CreateImageOptions {
                from_image: Some(image.to_string()),
                ..Default::default()
            };

            let mut stream = docker.create_image(Some(options), None, None);

            // Consume the stream to ensure the pull completes
            while let Some(result) = stream.next().await {
                result.map_err(Self::error)?;
            }

            tracing::info!("Successfully pulled Docker image: {}", image);
        }

        Ok(())
    }

    /// Sanitize an image name for use as a container name.
    ///
    /// Extracts just the image name (after the last /), removes tags and digests.
    fn image_basename(image: &str) -> String {
        // remove digest (everything after @)
        let without_digest = image.split('@').next().unwrap_or(image);

        // extract just the image name (after the last /)
        let image_part = without_digest.rsplit('/').next().unwrap_or(without_digest);

        // Remove tag (everything after :)
        image_part
            .split(':')
            .next()
            .unwrap_or(image_part)
            .to_string()
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

    pub async fn new_container(docker: Docker) -> Result<Container> {
        let env_vars = vec![
            format!("CONTROLLER_URL={}", "http://host.docker.internal:3005"),
            format!("MULTIPLAYER_URL={}", "ws://host.docker.internal:3001/ws"),
            format!("FILE_ID={}", "ae08a585-dd3a-4c90-8628-156cdebd21c4"),
            format!(
                "WORKER_EPHEMERAL_TOKEN={}",
                "550e8400-e29b-41d4-a716-446655440001"
            ),
        ];

        // Use alpine with a sleep command for testing container lifecycle
        // This is a small, publicly available image from Docker Hub
        // Generate a unique container name to avoid conflicts
        let container_name = format!("alpine-test-{}", Uuid::new_v4());

        Container::try_new(
            Uuid::new_v4(),
            Uuid::new_v4(),
            vec![(Uuid::new_v4(), Uuid::new_v4())],
            "alpine:latest",
            docker.clone(),
            Some(container_name),
            Some(env_vars),
            Some(vec!["sleep".to_string(), "30".to_string()]),
            None,
            None,
        )
        .await
    }

    #[test]
    fn test_sanitize_image_name_for_container() {
        // Simple image name without tag
        assert_eq!(
            Container::image_basename("quadratic-cloud-worker"),
            "quadratic-cloud-worker"
        );

        // Image name with tag
        assert_eq!(
            Container::image_basename("quadratic-cloud-worker:latest"),
            "quadratic-cloud-worker"
        );

        // Image name with digest
        assert_eq!(
            Container::image_basename("quadratic-cloud-worker@sha256:abcdef123456"),
            "quadratic-cloud-worker"
        );

        // ECR path without tag - extracts just the image name
        assert_eq!(
            Container::image_basename(
                "058264531788.dkr.ecr.us-west-2.amazonaws.com/quadratic-cloud-worker"
            ),
            "quadratic-cloud-worker"
        );

        // ECR path with tag - extracts just the image name without tag
        assert_eq!(
            Container::image_basename(
                "058264531788.dkr.ecr.us-west-2.amazonaws.com/quadratic-cloud-worker:latest"
            ),
            "quadratic-cloud-worker"
        );

        // Registry with port and image with tag - extracts just the image name
        assert_eq!(
            Container::image_basename("registry.com:5000/myimage:v1.0"),
            "myimage"
        );

        // Multi-level path with tag - extracts just the image name
        assert_eq!(
            Container::image_basename("registry.com/path/to/image:tag"),
            "image"
        );

        // Image with tag and digest
        assert_eq!(
            Container::image_basename("myimage:latest@sha256:abcdef"),
            "myimage"
        );

        assert_eq!(
            Container::image_basename(
                "058264531788.dkr.ecr.us-west-2.amazonaws.com/quadratic-cloud-worker:latest"
            ),
            "quadratic-cloud-worker"
        );
    }

    #[tokio::test]
    async fn test_container() -> Result<()> {
        let mut docker = Docker::connect_with_socket_defaults()
            .map_err(|e| SharedError::Docker(DockerError::Container(e.to_string())))?;
        let container = Arc::new(Mutex::new(new_container(docker.clone()).await?));

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

        container.lock().await.start(docker.clone()).await?;

        println!("Started worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.stop(&mut docker).await?;

        println!("Stopped worker: {}", container.lock().await);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        container.lock().await.remove(&mut docker).await?;

        println!("Removed worker: {}", container.lock().await);

        Ok(())
    }
}
