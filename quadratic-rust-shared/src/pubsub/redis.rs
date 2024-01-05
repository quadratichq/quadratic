use futures_util::stream::{Stream, StreamExt};
use redis::{
    aio::{AsyncStream, MultiplexedConnection, PubSub},
    AsyncCommands, Client,
};
use std::pin::Pin;

use crate::pubsub::Config;
use crate::{error::Result, SharedError};

#[derive(Debug, Clone)]
pub struct RedisConfig {
    host: String,
    port: String,
    password: String,
}

pub type PubSubConnection = PubSub<Pin<Box<dyn AsyncStream + Send + Sync>>>;

pub struct RedisConnection {
    pub pubsub: PubSubConnection,
    multiplex: MultiplexedConnection,
}

fn client(config: Config) -> Result<Client> {
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
    async fn publish(&mut self, channel: &str, _key: &str, value: &str) -> Result<()> {
        self.multiplex.publish(channel, value).await?;
        Ok(())
    }

    /// Acknowledge that a message was processed
    async fn ack(&mut self, _channel: &str, _keys: Vec<&str>) -> Result<()> {
        Ok(())
    }

    async fn messages(
        &mut self,
        channel: &str,
        max_messages: usize,
    ) -> Result<Vec<(String, String)>> {
        Ok(vec![])
    }

    // /// Get the next message from the pubsub server.
    // async fn poll<T>(&mut self) -> impl Stream {
    //     self.pubsub.on_message()
    // }
}

#[cfg(test)]
pub mod tests {
    use std::vec;

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
        let messages = vec!["test 1", "test 2"];
        let (config, channel) = setup();

        let config_clone = config.clone();
        let channel_clone = channel.clone();
        let handle = tokio::spawn(async move {
            let mut connection = RedisConnection::new(config_clone).await.unwrap();
            connection.subscribe(&channel_clone).await.unwrap();
            let mut received = vec![];

            while let Some(message) = connection.pubsub.on_message().next().await {
                received.push(message.get_payload::<String>().unwrap());

                if received.len() == 2 {
                    break;
                }
            }

            received
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        let mut connection = RedisConnection::new(config).await.unwrap();

        for message in messages.iter() {
            connection.publish(&channel, "", message).await.unwrap();
        }

        let received = handle.await.unwrap();

        assert_eq!(received, messages);
    }
}
