use redis::{
    aio::{AsyncStream, Monitor, MultiplexedConnection, PubSub},
    streams::{StreamId, StreamKey, StreamReadOptions, StreamReadReply},
    AsyncCommands, Client, Value,
};
use std::fmt::{self, Debug};
use std::pin::Pin;

use crate::pubsub::Config;
use crate::{error::Result, SharedError};

#[derive(Debug, Clone)]
pub struct RedisStreamsConfig {
    pub host: String,
    pub port: String,
    pub password: String,
}

pub type PubSubConnection = PubSub<Pin<Box<dyn AsyncStream + Send + Sync>>>;

pub struct RedisConnection {
    pub multiplex: MultiplexedConnection,
    pub monitor: Monitor,
}

impl Debug for RedisConnection {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self.multiplex)
    }
}

fn client(config: Config) -> Result<Client> {
    if let Config::RedisStreams(RedisStreamsConfig {
        host,
        port,
        password,
    }) = config
    {
        let params = format!("redis://:{password}@{host}:{port}");

        return Ok(Client::open(params)?);
    }

    Err(SharedError::PubSub(
        "Config type must be RedisStreamsConfig".into(),
    ))
}

fn to_key(key: &str) -> String {
    format!("{key}-0")
}

fn to_keys(keys: Vec<&str>) -> Vec<String> {
    keys.iter().map(|key| to_key(key)).collect::<Vec<_>>()
}

fn from_key(key: &str) -> String {
    key.split_once("-").unwrap().0.to_string()
}

fn from_value(value: &Value) -> String {
    if let Value::Data(bytes) = value {
        String::from_utf8(bytes.to_owned()).unwrap()
    } else {
        "".into()
    }
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
            multiplex: client.get_multiplexed_async_connection().await?,
            monitor: client.get_async_connection().await?.into_monitor(),
        };
        Ok(connection)
    }

    /// Create a group and a key (if it doesn't already exist), start from the beginning
    async fn subscribe(&mut self, channel: &str, group: &str) -> Result<()> {
        self.multiplex
            .xgroup_create_mkstream(channel, group, "$")
            .await?;
        Ok(())
    }

    /// Publish a message to a channel.
    async fn publish(&mut self, channel: &str, key: &str, value: &str) -> Result<()> {
        self.multiplex.xadd(channel, key, &[(key, value)]).await?;
        Ok(())
    }

    /// Acknowledge that a message was processed
    async fn ack(&mut self, channel: &str, keys: Vec<&str>) -> Result<()> {
        let ids = to_keys(keys);

        self.multiplex
            .xack::<&str, &str, String, u128>(channel, channel, &ids)
            .await?;
        Ok(())
    }

    async fn messages(
        &mut self,
        channel: &str,
        group: &str,
        keys: Option<Vec<&str>>,
        max_messages: usize,
    ) -> Result<Vec<(String, String)>> {
        // convert keys to ids, default to all new messages (">") if None
        let ids = keys.map_or_else(|| vec![">".to_string()], |keys| to_keys(keys));

        // redis requires the number of keys to match the number of ids
        let keys = vec![channel; ids.len()];

        let opts = StreamReadOptions::default()
            .count(max_messages)
            .group(&group, &channel);

        let raw_messages: Result<StreamReadReply> = self
            .multiplex
            .xread_options(&keys, &ids, &opts)
            .await
            .map_err(|e| {
                SharedError::PubSub(format!("Error reading messages for channel {channel}: {e}"))
            });

        let messages = raw_messages?
            .keys
            .iter()
            .flat_map(|StreamKey { key, ids }| {
                ids.iter().map(move |StreamId { id, map: value }| {
                    println!("id: {:?}, key: {:?}, value: {:?}", id, key, value);
                    let parsed_id = from_key(id);
                    let message = from_value(value.iter().next().unwrap().1);
                    println!("parsed_id: {:?}, message: {:?}", parsed_id, message);
                    (parsed_id.to_string(), message)
                })
            })
            .collect::<Vec<_>>();

        Ok(messages)
    }
}

#[cfg(test)]
pub mod tests {
    use std::vec;
    use uuid::Uuid;

    use super::*;
    use crate::pubsub::PubSub;

    fn setup() -> (Config, String) {
        let channel = Uuid::new_v4().to_string();
        let config = Config::RedisStreams(RedisStreamsConfig {
            host: "0.0.0.0".into(),
            port: "6379".into(),
            password: "".into(),
        });

        (config, channel)
    }

    #[tokio::test]
    async fn stream_connect_subscribe_publish_get_message() {
        let messages = vec!["test 1", "test 2"];
        let (config, channel) = setup();
        let group = "group 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group).await.unwrap();

        // send messages
        for (key, value) in messages.iter().enumerate() {
            connection
                .publish(&channel, &(key + 1).to_string(), value)
                .await
                .unwrap();
        }

        // println!(
        //     "{:?}",
        //     connection
        //         .multiplex
        //         .xinfo_consumers::<String, String, String>(channel.clone(), channel.clone())
        //         .await
        // );
        // println!(
        //     "{:?}",
        //     connection
        //         .multiplex
        //         .xinfo_groups::<String, String>(channel.clone())
        //         .await
        // );
        // println!(
        //     "{:#?}",
        //     connection
        //         .multiplex
        //         .xinfo_stream::<String, String>(channel.clone())
        //         .await
        // );

        let results = connection
            .messages(&channel, group, None, 10)
            .await
            .unwrap();
        println!("results: {:?}", results);

        results.iter().enumerate().for_each(|(key, (id, value))| {
            assert_eq!(messages[key], value);
        });

        let ids = results
            .iter()
            .map(|val| val.0.as_str())
            .collect::<Vec<&str>>();

        let pending = connection
            .multiplex
            .xpending::<&str, &str, Value>(&channel, group)
            .await
            .unwrap();

        println!("pending: {:?}", pending);

        // acknowledge
        if ids.len() > 0 {
            connection.ack(&channel, ids.clone()).await.unwrap();
        }

        let pending = connection
            .multiplex
            .xpending::<&str, &str, Value>(&channel, group)
            .await
            .unwrap();

        println!("pending: {:?}", pending);

        if ids.len() > 0 {
            let results = connection
                .messages(&channel, group, Some(ids), 10)
                .await
                .unwrap();

            println!("results: {:?}", results);
        }
    }
}
