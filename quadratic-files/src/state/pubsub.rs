use quadratic_rust_shared::pubsub::{
    redis_streams::RedisConnection, Config as PubSubConfig, PubSub as PubSubTrait,
};

use crate::error::Result;

#[derive(Debug)]
pub(crate) struct PubSub {
    pub(crate) config: PubSubConfig,
    pub(crate) connection: RedisConnection,
}

impl PubSub {
    /// Create a new connection to the PubSub server
    pub(crate) async fn new(config: PubSubConfig) -> Result<Self> {
        let connection = Self::connect(&config).await?;
        Ok(PubSub { config, connection })
    }

    /// Connect to the PubSub server
    pub(crate) async fn connect(config: &PubSubConfig) -> Result<RedisConnection> {
        let connection = RedisConnection::new(config.to_owned()).await?;
        Ok(connection)
    }

    /// Check if the connection is healthy and attempt to reconnect if not
    pub(crate) async fn reconnect_if_unhealthy(&mut self) {
        let is_healthy = self.connection.is_healthy().await;

        if !is_healthy {
            tracing::error!("PubSub connection is unhealthy");

            match Self::connect(&self.config).await {
                Ok(connection) => {
                    self.connection = connection;
                    tracing::info!("PubSub connection is now healthy");
                }
                Err(error) => {
                    tracing::error!("Error reconnecting to PubSub {error}");
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    // use super::*;
}
