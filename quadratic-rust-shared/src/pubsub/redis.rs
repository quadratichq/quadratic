use futures_util::stream::StreamExt;
use redis::{
    aio::{AsyncStream, MultiplexedConnection, PubSub},
    AsyncCommands, Client,
};
use std::pin::Pin;

use crate::pubsub::Config;
use crate::{error::Result, SharedError};

pub struct RedisConfig {
    host: String,
    port: String,
    password: String,
}

pub type PubSubConnection = PubSub<Pin<Box<dyn AsyncStream + Send + Sync>>>;

pub struct RedisConnection {
    pubsub: PubSubConnection,
    multiplex: MultiplexedConnection,
}

fn client(config: Config) -> Result<Client> {
    // TODO(ddimaria): remove once we have more than one pubsub implementation
    #[allow(irrefutable_let_patterns)]
    if let Config::Redis(RedisConfig {
        host,
        port,
        password,
    }) = config
    {
        let params = format!("redis://:{password}@{host}:{port}");

        return Ok(Client::open(params)?);
    }

    Err(SharedError::PubSub(
        "Config type must be RedisConfig".into(),
    ))
}

impl super::PubSub for RedisConnection {
    type Connection = RedisConnection;

    /// Create a new connection to the redis pubsub server.
    async fn new(config: Config) -> Result<RedisConnection> {
        Self::connect(config).await
    }

    /// Async connect to the redis pubsub server.
    async fn connect(config: Config) -> Result<RedisConnection> {
        let client = client(config)?;
        let connection = RedisConnection {
            pubsub: client.get_async_connection().await?.into_pubsub(),
            multiplex: client.get_multiplexed_async_connection().await?,
        };
        Ok(connection)
    }

    /// Subscribe to a channel.
    async fn subscribe(&mut self, channel: &str) -> Result<()> {
        self.pubsub.subscribe(channel).await?;
        Ok(())
    }

    /// Publish a message to a channel.
    async fn publish(&mut self, channel: &str, message: &str) -> Result<()> {
        self.multiplex.publish(channel, message).await?;
        Ok(())
    }

    /// Get the next message from the pubsub server.
    async fn get_message(&mut self) -> Result<Option<String>> {
        let payload: Result<Option<String>> = self
            .pubsub
            .on_message()
            .next()
            .await
            .map_or_else(|| Ok(None), |message| Ok(Some(message.get_payload()?)));

        payload
    }
}

#[cfg(test)]
pub mod tests {
    use uuid::Uuid;

    use crate::pubsub::PubSub;

    use super::*;

    fn setup() -> (Config, String) {
        let channel = Uuid::new_v4().to_string();
        let config = Config::Redis(RedisConfig {
            host: "0.0.0.0".into(),
            port: "6379".into(),
            password: "".into(),
        });

        (config, channel)
    }

    #[tokio::test]
    async fn connect_subscribe_publish_get_message() {
        let (config, channel) = setup();
        let message = "test";
        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel).await.unwrap();
        connection.publish(&channel, message).await.unwrap();
        let message_read = connection.get_message().await.unwrap().unwrap();

        assert_eq!(message_read, message);
    }
}
