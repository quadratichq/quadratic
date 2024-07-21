use chrono::prelude::*;
use futures_util::StreamExt;
use redis::{
    aio::{AsyncStream, Monitor, MultiplexedConnection, PubSub},
    cmd,
    streams::{StreamId, StreamKey, StreamRangeReply, StreamReadOptions, StreamReadReply},
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
    pub active_channels: String,
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

type Message = (String, String);

fn client(config: Config) -> Result<Client> {
    if let Config::RedisStreams(RedisStreamsConfig {
        host,
        port,
        password,
        ..
    }) = config
    {
        let params = format!("redis://:{password}@{host}:{port}");

        return Ok(Client::open(params)?);
    }

    Err(SharedError::PubSub(
        "Config type must be RedisStreamsConfig".into(),
    ))
}

fn to_key(key: &str, preserve_sequence: bool) -> String {
    if preserve_sequence {
        key.into()
    } else {
        format!("{key}-0")
    }
}

fn to_keys(keys: Vec<&str>, preserve_sequence: bool) -> Vec<String> {
    keys.iter()
        .map(|key| to_key(key, preserve_sequence))
        .collect::<Vec<_>>()
}

fn from_key(key: &str) -> String {
    key.split_once('-').unwrap_or_default().0.to_string()
}

fn from_value(value: &Value) -> String {
    if let Value::Data(bytes) = value {
        String::from_utf8(bytes.to_owned()).unwrap_or_default()
    } else {
        "".into()
    }
}

fn parse_message(id: &StreamId, preserve_sequence: bool) -> Message {
    let StreamId { mut id, map: value } = id.to_owned();

    if !preserve_sequence {
        id = from_key(&id);
    }

    let message = from_value(value.iter().next().unwrap().1);
    (id.to_string(), message)
}

fn stream_ids_to_messages(ids: Vec<StreamId>, preserve_sequence: bool) -> Vec<Message> {
    ids.iter()
        .map(|id| parse_message(id, preserve_sequence))
        .collect::<Vec<_>>()
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
            monitor: client.get_async_monitor().await?,
        };
        Ok(connection)
    }

    /// Determine if the service is healthy
    async fn is_healthy(&mut self) -> bool {
        let ping = self.multiplex.send_packed_command(&cmd("PING")).await;

        ping.is_ok()
    }

    /// Get a list of channels
    async fn channels(&mut self) -> Result<Vec<String>> {
        let channels = self
            .multiplex
            .scan::<String>()
            .await?
            .collect::<Vec<String>>()
            .await;

        Ok(channels)
    }

    /// Get a list of active channels
    async fn active_channels(&mut self, set_key: &str) -> Result<Vec<String>> {
        let channels = self
            .multiplex
            .zrangebyscore(set_key, "-inf", "+inf")
            .await?;

        Ok(channels)
    }

    /// Insert or update a key within an active channel
    async fn upsert_active_channel(&mut self, set_key: &str, channel: &str) -> Result<()> {
        let score = Utc::now().timestamp_millis();
        self.multiplex.zadd(set_key, channel, score).await?;

        Ok(())
    }

    /// Remove an a key within an active channel
    async fn remove_active_channel(&mut self, set_key: &str, channel: &str) -> Result<()> {
        self.multiplex.zrem(set_key, channel).await?;
        Ok(())
    }

    /// Create a group and a key (if it doesn't already exist), start from the beginning
    async fn subscribe(&mut self, channel: &str, group: &str) -> Result<()> {
        let result = self
            .multiplex
            .xgroup_create_mkstream::<&str, &str, &str, String>(channel, group, "$")
            .await;

        match result {
            Ok(_) => Ok(()),
            Err(e) => {
                // ignore BUSYGROUP errors, which indicate the group already exists
                if e.to_string().contains("BUSYGROUP") {
                    Ok(())
                } else {
                    Err(SharedError::PubSub(format!(
                        "Error creating group {group} for channel {channel}: {e}"
                    )))
                }
            }
        }
    }

    /// Publish a message to a channel.
    async fn publish(
        &mut self,
        channel: &str,
        key: &str,
        value: &str,
        active_channel: Option<&str>,
    ) -> Result<()> {
        // add the message to the stream
        self.multiplex.xadd(channel, key, &[(key, value)]).await?;

        // add the channel to the active channels set
        if let Some(active_channel) = active_channel {
            self.upsert_active_channel(active_channel, channel).await?
        }

        Ok(())
    }

    /// Acknowledge that a message was processed
    async fn ack(
        &mut self,
        channel: &str,
        group: &str,
        keys: Vec<&str>,
        active_channel: Option<&str>,
        preserve_sequence: bool,
    ) -> Result<()> {
        if keys.is_empty() {
            return Err(SharedError::PubSub(
                "Error acking messages for channel {channel}: no keys provided".into(),
            ));
        }

        let ids = to_keys(keys, preserve_sequence);

        self.multiplex
            .xack::<&str, &str, String, u128>(channel, group, &ids)
            .await?;

        // remove the channel from the active channels set
        if let Some(active_channel) = active_channel {
            self.remove_active_channel(active_channel, channel).await?
        }

        Ok(())
    }

    /// Trim messages from a channel
    async fn trim(&mut self, channel: &str, key: &str) -> Result<i64> {
        let xtrim = cmd("XTRIM").arg(channel).arg("MINID").arg(key).to_owned();
        let value = self.multiplex.send_packed_command(&xtrim).await?;

        match value {
            Value::Int(num) => Ok(num),
            _ => Err(SharedError::PubSub(
                "Error trimming messages for channel {channel} key {key}".into(),
            )),
        }
    }

    /// Get unread messages from a channel.  Specify the keys to get messages for,
    /// or None to get all new messages.
    ///
    /// After receiving messages, they enter a pending queue in Redis.
    ///
    /// Once messages are processed, they must be acknowledged with `ack` to
    /// remove them from the pending queue.
    async fn messages(
        &mut self,
        channel: &str,
        group: &str,
        consumer: &str,
        maybe_id: Option<&str>,
        max_messages: usize,
        preserve_sequence: bool,
    ) -> Result<Vec<Message>> {
        // convert id, default to all new messages (">") if None
        let id = maybe_id.map_or_else(|| ">".into(), |id| to_key(id, preserve_sequence));

        let opts = StreamReadOptions::default()
            .count(max_messages)
            .group(group, consumer);

        let raw_messages: Result<StreamReadReply> = self
            .multiplex
            .xread_options(&[channel], &[&id], &opts)
            .await
            .map_err(|e| {
                SharedError::PubSub(format!("Error reading messages for channel {channel}: {e}"))
            });

        let messages = raw_messages?
            .keys
            .iter()
            .flat_map(|StreamKey { key: _key, ids }| {
                ids.iter().map(|id| parse_message(id, preserve_sequence))
            })
            .collect::<Vec<_>>();

        Ok(messages)
    }

    /// Get messages from the beginning of a channel ending at a specific id
    async fn get_messages_before(
        &mut self,
        channel: &str,
        id: &str,
        preserve_sequence: bool,
    ) -> Result<Vec<Message>> {
        let messages: StreamRangeReply = self.multiplex.xrange(channel, "-", id).await?;

        Ok(stream_ids_to_messages(messages.ids, preserve_sequence))
    }

    /// Get messages from a channel starting from a specific id
    async fn get_messages_from(
        &mut self,
        channel: &str,
        id: &str,
        preserve_sequence: bool,
    ) -> Result<Vec<Message>> {
        let messages: StreamRangeReply = self.multiplex.xrange(channel, id, "+").await?;

        Ok(stream_ids_to_messages(messages.ids, preserve_sequence))
    }

    /// Get the last message in a channel
    async fn last_message(&mut self, channel: &str, preserve_sequence: bool) -> Result<Message> {
        let message: StreamRangeReply =
            self.multiplex.xrevrange_count(channel, "+", "-", 1).await?;

        let id = message.ids.first().ok_or_else(|| {
            SharedError::PubSub("Error getting last message: no messages found".into())
        })?;

        Ok(parse_message(id, preserve_sequence))
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
            active_channels: Uuid::new_v4().to_string(),
        });

        (config, channel)
    }

    #[tokio::test]
    async fn stream_connect_subscribe_publish_get_message() {
        let (config, channel) = setup();
        let messages = ["test 1", "test 2"];
        let group = "group 1";
        let consumer = "consumer 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group).await.unwrap();

        // send messages
        for (key, value) in messages.iter().enumerate() {
            connection
                .publish(&channel, &(key + 1).to_string(), value, None)
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

        // get all new messages
        let results = connection
            .messages(&channel, group, consumer, None, 10, false)
            .await
            .unwrap();

        results.iter().enumerate().for_each(|(key, (_id, value))| {
            assert_eq!(messages[key], value);
        });

        let ids = results
            .iter()
            .map(|val| val.0.as_str())
            .collect::<Vec<&str>>();

        // let pending = connection
        //     .multiplex
        //     .xpending::<&str, &str, Value>(&channel, group)
        //     .await
        //     .unwrap();

        // println!("pending: {:?}", pending);

        // acknowledge all messages
        connection
            .ack(&channel, group, ids.clone(), None, false)
            .await
            .unwrap();

        // let pending = connection
        //     .multiplex
        //     .xpending::<&str, &str, Value>(&channel, group)
        //     .await
        //     .unwrap();

        // println!("pending: {:?}", pending);

        let max_id = ids.into_iter().max().unwrap();
        let results = connection
            .messages(&channel, group, consumer, Some(max_id), 10, false)
            .await
            .unwrap();

        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn stream_get_last_message() {
        let (config, channel) = setup();
        let messages = ["test 1", "test 2"];
        let group = "group 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group).await.unwrap();

        // send messages
        for (key, value) in messages.iter().enumerate() {
            connection
                .publish(&channel, &(key + 1).to_string(), value, None)
                .await
                .unwrap();
        }

        // get the last message
        let results = connection.last_message(&channel, false).await.unwrap();

        assert_eq!(results, ("2".into(), messages[1].into()));
    }

    #[tokio::test]
    async fn stream_get_all_channels() {
        let (config, channel) = setup();
        let messages = ["test 1", "test 2"];
        let group = "group 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group).await.unwrap();

        // send messages
        for (key, value) in messages.iter().enumerate() {
            connection
                .publish(&channel, &(key + 1).to_string(), value, None)
                .await
                .unwrap();
        }

        // get all channels
        let results = connection.channels().await.unwrap();

        assert!(results.contains(&channel));
    }

    #[tokio::test]
    async fn stream_active_channels() {
        let (config, channel) = setup();
        let messages = ["test 1", "test 2"];
        let group = "group 1";
        let mut channels = [Uuid::new_v4().to_string(), Uuid::new_v4().to_string()];
        let active_channels = Uuid::new_v4().to_string();

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group).await.unwrap();

        // send messages
        for (key, value) in messages.iter().enumerate() {
            connection
                .publish(
                    &channels[key],
                    &(key + 1).to_string(),
                    value,
                    Some(&active_channels),
                )
                .await
                .unwrap();
        }

        // get all channels
        let mut results = connection.active_channels(&active_channels).await.unwrap();

        // active channels should exist and contain the channels (order seems random; although it was indicated to be in order when test was first written)
        results.sort();
        channels.sort();
        assert_eq!(results, channels);

        // now update the first channel
        connection
            .upsert_active_channel(&active_channels, &channels[0])
            .await
            .unwrap();

        let mut results = connection.active_channels(&active_channels).await.unwrap();
        results.sort();
        let mut channel_results = vec![channels[1].clone(), channels[0].clone()];
        channel_results.sort();
        assert_eq!(results, channel_results);

        // remove the first channel
        connection
            .remove_active_channel(&active_channels, &channels[0])
            .await
            .unwrap();

        let results = connection.active_channels(&active_channels).await.unwrap();
        assert_eq!(results, vec![channels[1].clone()]);
    }
}
