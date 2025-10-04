//! Cluster
//!
//! A cluster is a collection of containers.

use std::collections::HashMap;
use std::fmt::Display;
use std::sync::Arc;

pub use bollard::Docker;
use bollard::query_parameters::ListContainersOptions;
use bollard::secret::ContainerSummary;
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
    pub(crate) docker: Arc<Mutex<Docker>>,
    pub(crate) containers: HashMap<String, Arc<Mutex<Container>>>,
}

impl Display for Cluster {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            r#"Cluster(id: {}, containers: {})"#,
            self.id,
            self.containers.len()
        )
    }
}

impl Cluster {
    /// Create a new cluster
    pub async fn try_new() -> Result<Self> {
        let docker = Docker::connect_with_socket_defaults()
            .map_err(|e| SharedError::Docker(DockerError::Connection(e.to_string())))?;

        Ok(Self {
            id: Uuid::new_v4(),
            docker: Arc::new(Mutex::new(docker)),
            containers: HashMap::new(),
        })
    }

    /// List all container ids
    pub async fn list_ids(&self) -> Result<Vec<String>> {
        let containers = self.containers.keys().cloned().collect::<Vec<String>>();

        Ok(containers)
    }

    /// List all containers, including ones not part of this cluster
    pub async fn list_all(&self) -> Result<Vec<ContainerSummary>> {
        let containers = self
            .docker
            .lock()
            .await
            .list_containers(None::<ListContainersOptions>)
            .await
            .map_err(Self::error)?;

        Ok(containers)
    }

    /// Get a container
    pub async fn get_container(&self, id: &str) -> Result<&Arc<Mutex<Container>>> {
        self.containers
            .get(id)
            .ok_or(Self::error("Container not found"))
    }

    /// Get a mutable reference to a container
    pub async fn get_container_mut(&mut self, id: &str) -> Result<&mut Arc<Mutex<Container>>> {
        self.containers
            .get_mut(id)
            .ok_or(Self::error("Container not found"))
    }

    /// Check if a container exists
    pub async fn has_container(&self, id: &str) -> Result<bool> {
        Ok(self.containers.contains_key(id))
    }

    /// Add a container
    pub async fn add_container(
        &mut self,
        container: Arc<Mutex<Container>>,
        start: bool,
    ) -> Result<()> {
        let id = container.lock().await.id.to_owned();
        self.containers.insert(id, Arc::clone(&container));

        if start {
            container.lock().await.start().await?;
        }

        let log_container = container.clone();
        tokio::spawn(async move {
            loop {
                if let Ok(logs) = log_container.lock().await.logs().await {
                    println!("[{}] Logs: {}", log_container.lock().await.id, logs);
                }

                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        });

        Ok(())
    }

    /// Remove a container
    ///
    /// First, remove the container from docker daemon, then remove the container from the cluster.
    pub async fn remove_container(&mut self, id: &str) -> Result<()> {
        if let Some(container) = self.containers.get(id) {
            container.lock().await.remove().await?;
        }

        self.containers.remove(id);

        Ok(())
    }

    pub fn docker(&self) -> Arc<Mutex<Docker>> {
        Arc::clone(&self.docker)
    }

    /// Error helper
    fn error(error: impl ToString) -> SharedError {
        SharedError::Docker(DockerError::Cluster(error.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docker::container::tests::new_container;

    pub async fn new_cluster() -> Cluster {
        let mut cluster = Cluster::try_new().await.unwrap();

        let container = new_container(cluster.docker.clone()).await;
        cluster.add_container(container, true).await.unwrap();

        let container = new_container(cluster.docker.clone()).await;
        cluster.add_container(container, true).await.unwrap();

        cluster
    }

    #[tokio::test]
    async fn test_cluster() {
        let cluster = new_cluster().await;
        let container_ids = cluster.list_ids().await.unwrap();

        assert_eq!(container_ids.len(), 2);

        let container = cluster.get_container(&container_ids[0]).await.unwrap();
        let container = container.lock().await;

        assert_eq!(container.id, container_ids[0]);
    }
}
