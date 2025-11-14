//! Redis Streams
//!
//! Functions to interact with Redis Streams

use chrono::prelude::*;
use futures_util::StreamExt;
use redis::{
    AsyncCommands, Client, Script, Value,
    aio::{Monitor, MultiplexedConnection, PubSub},
    cmd,
    streams::{StreamId, StreamKey, StreamRangeReply, StreamReadOptions, StreamReadReply},
};
use std::{
    fmt::{self, Debug},
    vec,
};

use crate::pubsub::Config;
use crate::{SharedError, error::Result};

/// Redis Streams configuration
#[derive(Debug, Clone)]
pub struct RedisStreamsConfig {
    pub host: String,
    pub port: String,
    pub password: String,
}

/// Redis Streams connection
pub type PubSubConnection = PubSub;

/// Redis Streams connection
pub struct RedisConnection {
    pub multiplex: MultiplexedConnection,
    pub monitor: Monitor,
}

impl Debug for RedisConnection {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self.multiplex)
    }
}

/// A message consists of a key (String) and a value (Bytes).
type Message = (String, Vec<u8>);

/// Create a Redis client
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

/// Convert a key to a string, either preserving the sequence or adding a sequence number
fn to_key(key: &str, preserve_sequence: bool) -> String {
    if preserve_sequence {
        key.into()
    } else {
        format!("{key}-0")
    }
}

/// Convert a vector of keys to a vector of strings, either preserving the sequence or adding a sequence number
fn to_keys(keys: Vec<&str>, preserve_sequence: bool) -> Vec<String> {
    keys.iter()
        .map(|key| to_key(key, preserve_sequence))
        .collect::<Vec<_>>()
}

/// Convert a key to a string, removing the sequence number
fn from_key(key: &str) -> String {
    key.split_once('-').unwrap_or_default().0.to_string()
}

/// Convert a Redis value to a vector of bytes
fn value_bytes(value: Value) -> Vec<u8> {
    match value {
        Value::BulkString(bytes) => bytes,
        _ => vec![],
    }
}

/// Parse a Redis message
fn parse_message(id: &StreamId, preserve_sequence: bool) -> Message {
    let StreamId {
        mut id,
        map: values,
    } = id.to_owned();

    if !preserve_sequence {
        id = from_key(&id);
    }

    let value = values.iter().next().unwrap().1.to_owned();
    let message = value_bytes(value);
    (id.to_string(), message)
}

/// Parse a Redis message that was stored with dedupe key (publish_once_with_dedupe_key)
fn parse_message_with_dedupe_key(id: &StreamId, preserve_sequence: bool) -> Message {
    let StreamId {
        mut id,
        map: values,
    } = id.to_owned();

    if !preserve_sequence {
        id = from_key(&id);
    }

    // Look specifically for the 'data' field when using publish_once,
    // fall back to first field
    let value = values
        .get("data")
        .or_else(|| values.iter().next().map(|(_, v)| v))
        .unwrap()
        .to_owned();

    let message = value_bytes(value);
    (id.to_string(), message)
}

/// Convert a vector of Redis stream ids to a vector of messages
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
        let () = self.multiplex.zadd(set_key, channel, score).await?;

        Ok(())
    }

    /// Remove an a key within an active channel
    async fn remove_active_channel(&mut self, set_key: &str, channel: &str) -> Result<()> {
        let () = self.multiplex.zrem(set_key, channel).await?;
        Ok(())
    }

    /// Get a list of scheduled tasks
    async fn scheduled_tasks(&mut self, set_key: &str) -> Result<Vec<String>> {
        let tasks = self
            .multiplex
            .zrangebyscore(set_key, "-inf", "+inf")
            .await?;
        Ok(tasks)
    }

    /// Insert or update a key within an active channel
    async fn upsert_scheduled_task(&mut self, set_key: &str, task: &str) -> Result<()> {
        let score = Utc::now().timestamp_millis();
        let () = self.multiplex.zadd(set_key, task, score).await?;

        Ok(())
    }

    /// Remove an a key within an active channel
    async fn remove_scheduled_task(&mut self, set_key: &str, task: &str) -> Result<()> {
        let () = self.multiplex.zrem(set_key, task).await?;
        Ok(())
    }

    /// Create a group and a key (if it doesn't already exist), start from the beginning
    async fn subscribe(&mut self, channel: &str, group: &str, id: Option<&str>) -> Result<()> {
        let result = self
            .multiplex
            .xgroup_create_mkstream::<&str, &str, &str, String>(channel, group, id.unwrap_or("$"))
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

    /// Create a group and a key (if it doesn't already exist), start from the beginning
    /// This is different from subscribe() in that if the id doesn't exist, then the first message on the stream is used
    async fn subscribe_with_first_message(
        &mut self,
        channel: &str,
        group: &str,
        id: Option<&str>,
    ) -> Result<()> {
        let result = self
            .multiplex
            .xgroup_create_mkstream::<&str, &str, &str, String>(channel, group, id.unwrap_or("0"))
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
        value: &[u8],
        active_channel: Option<&str>,
    ) -> Result<()> {
        // add the message to the stream
        let () = self.multiplex.xadd(channel, key, &[(key, value)]).await?;

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

        // remove the channel from the active channels set ONLY if the channel is empty
        if let Some(active_channel) = active_channel {
            let len: usize = self.multiplex.xlen(channel).await?;
            if len == 0 {
                self.remove_active_channel(active_channel, channel).await?
            }
        }

        Ok(())
    }

    // Insert only once per dedupe key; returns true if added, false if already exists
    async fn publish_once_with_dedupe_key(
        &mut self,
        dedupe_key_prefix: &str,
        channel: &str,
        key: &str,
        value: &[u8],
        active_channel: Option<&str>,
    ) -> Result<bool> {
        let dedupe_key = format!("{dedupe_key_prefix}:{channel}");

        let script = Script::new(
            r#"
            local id = redis.call('HGET', KEYS[1], ARGV[1])
            if id then
              return {0, id}
            end
            local new_id = redis.call('XADD', KEYS[2], '*', 'data', ARGV[2], 'dedupe_key', ARGV[1])
            redis.call('HSET', KEYS[1], ARGV[1], new_id)
            return {1, new_id}
        "#,
        );

        let res: (i32, Option<String>) = script
            .key(&dedupe_key)
            .key(channel)
            .arg(key)
            .arg(value)
            .invoke_async(&mut self.multiplex)
            .await?;

        let is_added = res.0 == 1;

        // add the channel to the active channels set
        if is_added && let Some(active_channel) = active_channel {
            self.upsert_active_channel(active_channel, channel).await?
        }

        Ok(is_added)
    }

    // Ack by dedupe key using the mapping; returns true if acked
    async fn ack_once(
        &mut self,
        dedupe_key_prefix: &str,
        channel: &str,
        group: &str,
        key: &str,
        active_channel: Option<&str>,
    ) -> Result<()> {
        let dedupe_key = format!("{dedupe_key_prefix}:{channel}");

        // Fetch stream id for this dedupe key
        let id: Option<String> = self.multiplex.hget(&dedupe_key, key).await?;
        if let Some(stream_id) = id {
            // XACK
            self.multiplex
                .xack::<&str, &str, String, i64>(channel, group, &[stream_id])
                .await?;

            // Remove mapping
            let () = self.multiplex.hdel(&dedupe_key, key).await?;

            // remove the channel from the active channels set
            if let Some(active_channel) = active_channel {
                let len: usize = self.multiplex.xlen(channel).await?;
                if len == 0 {
                    let () = self.multiplex.zrem(active_channel, channel).await?;
                }
            }
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

    /// Get unread messages from a channel that were stored with deduplication.
    /// This method specifically handles messages with 'data' and 'dedupe_key' fields.
    async fn messages_with_dedupe_key(
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
                ids.iter()
                    .map(|id| parse_message_with_dedupe_key(id, preserve_sequence))
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

    async fn get_messages_between(
        &mut self,
        channel: &str,
        start: &str,
        end: &str,
        preserve_sequence: bool,
    ) -> Result<Vec<Message>> {
        let messages: StreamRangeReply = self.multiplex.xrange(channel, start, end).await?;

        Ok(stream_ids_to_messages(messages.ids, preserve_sequence))
    }

    /// Get messages from a channel starting from a specific id
    async fn get_messages_after(
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

    /// Get the length of a channel
    async fn length(&mut self, channel: &str) -> Result<usize> {
        let length = self.multiplex.xlen(channel).await?;
        Ok(length)
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
        let (config, channel) = setup();
        let messages = ["test 1".as_bytes(), "test 2".as_bytes()];
        let group = "group 1";
        let consumer = "consumer 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group, None).await.unwrap();

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
        let messages = ["test 1".as_bytes(), "test 2".as_bytes()];
        let group = "group 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group, None).await.unwrap();

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
        let messages = ["test 1".as_bytes(), "test 2".as_bytes()];
        let group = "group 1";

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group, None).await.unwrap();

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
        let messages = ["test 1".as_bytes(), "test 2".as_bytes()];
        let group = "group 1";
        let mut channels = [Uuid::new_v4().to_string(), Uuid::new_v4().to_string()];
        let active_channels = Uuid::new_v4().to_string();

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group, None).await.unwrap();

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

    #[tokio::test]
    async fn stream_ack_preserves_active_channel_when_messages_remain() {
        let (config, channel) = setup();
        let group = "group 1";
        let consumer = "consumer 1";
        let active_channels = Uuid::new_v4().to_string();

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group, None).await.unwrap();

        // Publish 3 messages to the channel
        for i in 1..=3 {
            connection
                .publish(
                    &channel,
                    &i.to_string(),
                    format!("test {}", i).as_bytes(),
                    Some(&active_channels),
                )
                .await
                .unwrap();
        }

        // Verify channel is in active channels
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert_eq!(results, vec![channel.clone()]);

        // Get first 2 messages
        let messages = connection
            .messages(&channel, group, consumer, None, 2, false)
            .await
            .unwrap();
        assert_eq!(messages.len(), 2);

        // Ack only the first message (2 messages remain in channel)
        let first_key = messages[0].0.as_str();
        connection
            .ack(
                &channel,
                group,
                vec![first_key],
                Some(&active_channels),
                false,
            )
            .await
            .unwrap();

        // Channel should STILL be in active channels because 2 messages remain
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert_eq!(
            results,
            vec![channel.clone()],
            "Channel should remain in active channels when messages still exist"
        );

        // Ack the second message (1 message remains)
        let second_key = messages[1].0.as_str();
        connection
            .ack(
                &channel,
                group,
                vec![second_key],
                Some(&active_channels),
                false,
            )
            .await
            .unwrap();

        // Channel should STILL be in active channels because 1 message remains
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert_eq!(
            results,
            vec![channel.clone()],
            "Channel should remain in active channels when 1 message still exists"
        );

        // Get and ack the last message
        let messages = connection
            .messages(&channel, group, consumer, None, 10, false)
            .await
            .unwrap();
        assert_eq!(messages.len(), 1);
        let last_key = messages[0].0.as_str();
        connection
            .ack(
                &channel,
                group,
                vec![last_key],
                Some(&active_channels),
                false,
            )
            .await
            .unwrap();

        // NOW the channel should be removed from active channels
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert!(
            results.is_empty(),
            "Channel should be removed from active channels when all messages are acked"
        );
    }

    #[tokio::test]
    async fn stream_worker_processes_multiple_batches_scenario() {
        // Integration test simulating the complete worker loop scenario:
        // 1. Controller publishes 150 tasks to Redis
        // 2. Controller creates worker with first 100 tasks
        // 3. Worker processes 100 tasks
        // 4. Worker acks 100 tasks -> channel stays active (50 remain)
        // 5. Worker checks for more tasks -> gets 50 more
        // 6. Worker processes 50 tasks
        // 7. Worker acks 50 tasks -> channel removed (0 remain)
        // 8. Worker checks for more tasks -> gets empty
        // 9. Worker shuts down

        let (config, channel) = setup();
        let group = "group 1";
        let consumer = "consumer 1";
        let active_channels = Uuid::new_v4().to_string();

        let mut connection = RedisConnection::new(config).await.unwrap();
        connection.subscribe(&channel, group, None).await.unwrap();

        // Step 1: Publish 150 tasks
        for i in 1..=150 {
            connection
                .publish(
                    &channel,
                    &i.to_string(),
                    format!("task {}", i).as_bytes(),
                    Some(&active_channels),
                )
                .await
                .unwrap();
        }

        // Verify channel is in active channels
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert_eq!(results, vec![channel.clone()]);

        // Step 2 & 3: Worker fetches and processes first 100 tasks
        let batch1 = connection
            .messages(&channel, group, consumer, None, 100, false)
            .await
            .unwrap();
        assert_eq!(batch1.len(), 100);

        // Step 4: Worker acks first 100 tasks
        let keys1: Vec<&str> = batch1.iter().map(|(k, _)| k.as_str()).collect();
        connection
            .ack(&channel, group, keys1, Some(&active_channels), false)
            .await
            .unwrap();

        // Channel should STILL be active (50 tasks remain)
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert_eq!(
            results,
            vec![channel.clone()],
            "Channel should remain active with 50 tasks remaining"
        );

        // Step 5: Worker fetches next batch (50 tasks)
        let batch2 = connection
            .messages(&channel, group, consumer, None, 100, false)
            .await
            .unwrap();
        assert_eq!(
            batch2.len(),
            50,
            "Should get remaining 50 tasks in second batch"
        );

        // Step 6 & 7: Worker processes and acks second batch
        let keys2: Vec<&str> = batch2.iter().map(|(k, _)| k.as_str()).collect();
        connection
            .ack(&channel, group, keys2, Some(&active_channels), false)
            .await
            .unwrap();

        // NOW channel should be removed (0 tasks remain)
        let results = connection.active_channels(&active_channels).await.unwrap();
        assert!(
            results.is_empty(),
            "Channel should be removed when all 150 tasks are acked"
        );

        // Step 8: Worker checks for more tasks
        let batch3 = connection
            .messages(&channel, group, consumer, None, 100, false)
            .await
            .unwrap();
        assert!(batch3.is_empty(), "No more tasks should be available");

        // Step 9: Worker shuts down (tested elsewhere)
    }
}
