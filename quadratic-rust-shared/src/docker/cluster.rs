//! Cluster
//!
//! A cluster is a collection of containers.

use std::collections::HashMap;
use std::fmt::Display;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

pub use bollard::Docker;
use bollard::query_parameters::{
    ListContainersOptions, ListImagesOptions, LogsOptions, RemoveContainerOptions,
};
use bollard::secret::ContainerSummary;
use futures_util::Stream;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::docker::container::Container;
use crate::{
    docker::error::Docker as DockerError,
    error::{Result, SharedError},
};

#[derive(Debug)]
pub struct Cluster {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub docker: Docker,
    pub(crate) containers: HashMap<Uuid, Arc<Mutex<Container>>>,
}

impl Display for Cluster {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            r#"Cluster(id: {}, name: {}, containers: {})"#,
            self.id,
            self.name,
            self.containers.len()
        )
    }
}

impl Cluster {
    /// Create a new cluster
    pub async fn try_new(name: &str) -> Result<Self> {
        let docker = Self::new_docker()?;

        Ok(Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            docker,
            containers: HashMap::new(),
        })
    }

    pub fn new_docker() -> Result<Docker> {
        let mut docker = Docker::connect_with_socket_defaults()
            .map_err(|e| SharedError::Docker(DockerError::Connection(e.to_string())))?;

        docker.set_timeout(Duration::from_secs(5));
        Ok(docker)
    }

    /// List all container ids
    pub async fn list_ids(&self) -> Result<Vec<Uuid>> {
        let containers = self.containers.keys().cloned().collect::<Vec<Uuid>>();

        Ok(containers)
    }

    /// List all containers, including ones not part of this cluster
    pub async fn list_all(&self) -> Result<Vec<ContainerSummary>> {
        let options = ListContainersOptions {
            all: true,
            ..Default::default()
        };
        let containers = self
            .docker
            .list_containers(Some(options))
            .await
            .map_err(Self::error)?;

        Ok(containers)
    }

    /// Get a container
    pub async fn get_container(&self, id: &Uuid) -> Result<Arc<Mutex<Container>>> {
        let container = self
            .containers
            .get(id)
            .ok_or(Self::error("Container not found"))?;

        Ok(Arc::clone(container))
    }

    /// Get a mutable reference to a container
    pub async fn get_container_mut(&mut self, id: &Uuid) -> Result<&mut Arc<Mutex<Container>>> {
        self.containers
            .get_mut(id)
            .ok_or(Self::error("Container not found"))
    }

    /// Check if a container exists
    pub async fn has_container(&self, id: &Uuid) -> Result<bool> {
        Ok(self.containers.contains_key(id))
    }

    /// Add a container
    pub async fn add_container(&mut self, container: Container, start: bool) -> Result<()> {
        let id = container.id.to_owned();
        let timeout_seconds = container.timeout_seconds.to_owned() as u64;
        let container = Arc::new(Mutex::new(container));

        if start {
            container.lock().await.start(self.docker.clone()).await?;
        }

        self.containers.insert(id, Arc::clone(&container));

        // in a separate thread,
        let container = Arc::clone(&container);
        let mut docker = self.docker.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(timeout_seconds)).await;

            tracing::info!("Stopping container in thread: {:?}", id);

            if let Err(e) = container.lock().await.stop(&mut docker).await {
                tracing::error!("Error stopping container: {:?}", e);
            }
        });

        Ok(())
    }

    /// Stop a container
    pub async fn stop_container(&mut self, id: &Uuid) -> Result<()> {
        tracing::trace!("Stopping container {id}");

        let container = self
            .containers
            .remove(id)
            .ok_or(Self::error("Container not found"))?;
        let mut docker = self.docker.clone();

        // remove in a separate thread
        tokio::spawn(async move {
            if let Err(e) = container.lock().await.stop(&mut docker).await {
                tracing::error!("Error stopping container: {:?}", e);
            }
            tracing::info!("Stopped container in thread: {:?}", container);
        });

        tracing::trace!("Stopped container {id}");

        Ok(())
    }

    /// Remove a container
    ///
    /// First, remove the container from docker daemon, then remove the container from the cluster.
    pub async fn remove_container(&mut self, id: &Uuid) -> Result<()> {
        tracing::info!("Removing container {id}");

        let container = self
            .containers
            .remove(id)
            .ok_or(Self::error("Container not found"))?;
        let mut docker = self.docker.clone();
        let total_runtime = container.lock().await.total_runtime();

        // remove in a separate thread
        let id = id.to_owned();
        tokio::spawn(async move {
            let resource_usage = container
                .lock()
                .await
                .get_resource_usage(docker.clone())
                .await;

            if let Err(e) = container.lock().await.remove(&mut docker).await {
                tracing::error!("Error removing container: {:?}", e);
            }

            if let Ok(Some((cpu_usage, memory_usage))) = resource_usage {
                tracing::info!(
                    "Removed worker for file {} in thread: Total Runtime: {} ms, Resource Usage - CPU: {:.2}%, Memory: {} bytes ({:.2} MB)",
                    id,
                    total_runtime,
                    cpu_usage,
                    memory_usage,
                    memory_usage as f64 / 1024.0 / 1024.0
                );
            }

            drop(container);
        });

        Ok(())
    }

    /// Remove a container by Docker container ID (not cluster UUID)
    pub async fn remove_container_by_docker_id(&mut self, docker_id: &str) -> Result<()> {
        let options = RemoveContainerOptions {
            force: true,
            ..Default::default()
        };
        self.docker
            .remove_container(docker_id, Some(options))
            .await
            .map_err(Self::error)?;

        Ok(())
    }

    /// Remove all containers that match the given image name substring.
    ///
    /// This checks both the container's image field and its name to find matches.
    /// Useful for cleanup on startup or shutdown.
    ///
    /// Returns the number of containers removed.
    pub async fn remove_containers_by_image_name(
        &mut self,
        image_name_substring: &str,
    ) -> Result<usize> {
        let summaries = self.list_all().await?;
        let mut removed_count = 0;

        for summary in summaries {
            // check both image name and container name to catch all matching containers
            let image_matches = summary
                .image
                .as_ref()
                .map(|img| img.contains(image_name_substring))
                .unwrap_or(false);

            let name_matches = summary
                .names
                .as_ref()
                .map(|names| names.iter().any(|name| name.contains(image_name_substring)))
                .unwrap_or(false);

            let should_remove = image_matches || name_matches;

            if should_remove && let Some(container_id) = &summary.id {
                let container_name = summary
                    .names
                    .as_ref()
                    .and_then(|n| n.first())
                    .map(|s| s.as_str())
                    .unwrap_or("unknown");

                tracing::trace!(
                    "Removing container: {} (ID: {})",
                    container_name,
                    container_id
                );

                if let Err(e) = self.remove_container_by_docker_id(container_id).await {
                    tracing::error!(
                        "Failed to remove container {} ({}): {}",
                        container_name,
                        container_id,
                        e
                    );
                } else {
                    removed_count += 1;
                }
            }
        }

        if removed_count > 0 {
            tracing::info!(
                "Removed {} container(s) matching '{}'",
                removed_count,
                image_name_substring
            );
        }

        Ok(removed_count)
    }

    /// Discover an image name by searching for a substring in available image tags.
    ///
    /// Returns the first image tag that contains the provided substring.
    /// Falls back to the substring itself if no matching image is found.
    pub async fn image_tag_from_image_name(&self, image_name_substring: &str) -> Result<String> {
        let options = ListImagesOptions {
            all: true,
            ..Default::default()
        };

        let images = self
            .docker
            .list_images(Some(options))
            .await
            .map_err(Self::error)?;

        // find the first image that contains the substring in any of its repo tags
        for image in &images {
            for tag in &image.repo_tags {
                if tag.contains(image_name_substring) {
                    return Ok(tag.clone());
                }
            }
        }

        Err(Self::error(format!(
            "Image not found: {}",
            image_name_substring
        )))
    }

    /// Create a logs stream for a container by its ID.
    ///
    /// Returns a stream of log outputs that can be consumed without holding any locks.
    /// This method extracts the container's image_id and creates a logs stream directly.
    pub async fn container_logs_stream(
        &self,
        id: &Uuid,
    ) -> Result<
        Pin<
            Box<
                dyn Stream<
                        Item = std::result::Result<
                            bollard::container::LogOutput,
                            bollard::errors::Error,
                        >,
                    > + Send,
            >,
        >,
    > {
        let container = self
            .containers
            .get(id)
            .ok_or(Self::error("Container not found"))?;

        let image_id = {
            let locked_container = container.lock().await;
            locked_container.image_id().to_string()
        };

        let options = LogsOptions {
            stdout: true,
            stderr: true,
            follow: true,
            tail: "0".to_string(),
            ..Default::default()
        };

        Ok(Box::pin(self.docker.logs(&image_id, Some(options))))
    }

    /// Error helper
    fn error(error: impl ToString) -> SharedError {
        SharedError::Docker(DockerError::Cluster(error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docker::container::{ContainerState, tests::new_container};

    pub async fn new_cluster() -> Cluster {
        let mut cluster = Cluster::try_new("test").await.unwrap();

        let container = new_container(cluster.docker.clone()).await;
        cluster.add_container(container, true).await.unwrap();

        let container = new_container(cluster.docker.clone()).await;
        cluster.add_container(container, true).await.unwrap();

        cluster
    }

    #[tokio::test]
    async fn test_cluster() {
        let mut cluster = new_cluster().await;
        let container_ids = cluster.list_ids().await.unwrap();

        assert_eq!(container_ids.len(), 2);

        let container = cluster.get_container(&container_ids[0]).await.unwrap();

        assert_eq!(container.lock().await.id, container_ids[0]);

        cluster.stop_container(&container_ids[0]).await.unwrap();

        let container = cluster.get_container(&container_ids[0]).await.unwrap();

        assert_eq!(container.lock().await.state, ContainerState::Stopped);

        cluster.remove_container(&container_ids[0]).await.unwrap();

        assert_eq!(cluster.containers.len(), 1);
    }

    #[tokio::test]
    #[ignore]
    async fn test_discover_image_name() {
        let cluster = Cluster::try_new("test-discovery").await.unwrap();
        let images = cluster
            .docker
            .list_images(Some(ListImagesOptions {
                all: true,
                ..Default::default()
            }))
            .await
            .unwrap();

        for image in &images {
            for tag in &image.repo_tags {
                if tag.contains("quadratic-cloud-worker") {
                    println!("  Found: {}", tag);
                }
            }
        }

        let result = cluster
            .image_tag_from_image_name("quadratic-cloud-worker")
            .await;

        match result {
            Ok(image) => {
                assert!(image.contains("quadratic-cloud-worker"));
            }
            Err(_e) => {
                for image in images {
                    println!("  Image ID: {}", image.id);
                    for tag in &image.repo_tags {
                        println!("    - {}", tag);
                    }
                }

                panic!("Image discovery failed");
            }
        }
    }
}
