//! Pubsub code that implements the PubSub trait

pub mod error;
pub mod redis;
pub mod redis_streams;

use futures_util::Future;

use crate::error::Result;
use crate::pubsub::redis::RedisConfig;
use crate::pubsub::redis_streams::RedisStreamsConfig;

/// Pubsub configuration
#[derive(Debug, Clone)]
pub enum Config {
    Redis(RedisConfig),
    RedisStreams(RedisStreamsConfig),
}

/// Pubsub trait
pub trait PubSub {
    type Connection;

    /// Create a new PubSub connection
    fn new(config: Config) -> impl Future<Output = Result<Self::Connection>> + Send;

    /// Connect to a PubSub service
    fn connect(config: Config) -> impl Future<Output = Result<Self::Connection>> + Send;

    /// Check if the PubSub service is healthy
    fn is_healthy(&mut self) -> impl Future<Output = bool> + Send;

    /// Get the channels
    fn channels(&mut self) -> impl Future<Output = Result<Vec<String>>> + Send;

    /// Get the active channels
    fn active_channels(
        &mut self,
        channel: &str,
    ) -> impl Future<Output = Result<Vec<String>>> + Send;

    /// Upsert an active channel
    fn upsert_active_channel(
        &mut self,
        set_key: &str,
        channel: &str,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Remove an active channel
    fn remove_active_channel(
        &mut self,
        set_key: &str,
        channel: &str,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Get a list of scheduled tasks
    fn scheduled_tasks(
        &mut self,
        set_key: &str,
    ) -> impl Future<Output = Result<Vec<String>>> + Send;

    /// Upsert a scheduled task
    fn upsert_scheduled_task(
        &mut self,
        set_key: &str,
        task: &str,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Remove a scheduled task
    fn remove_scheduled_task(
        &mut self,
        set_key: &str,
        task: &str,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Subscribe to a channel
    fn subscribe(
        &mut self,
        channel: &str,
        group: &str,
        id: Option<&str>,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Publish a message to a channel
    fn publish(
        &mut self,
        channel: &str,
        key: &str,
        value: &[u8],
        active_channel: Option<&str>,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Acknowledge a message
    fn ack(
        &mut self,
        channel: &str,
        group: &str,
        keys: Vec<&str>,
        active_channel: Option<&str>,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Trim a channel
    fn trim(&mut self, channel: &str, key: &str) -> impl Future<Output = Result<i64>> + Send;

    /// Publish a message to a channel once with dedupe key
    fn publish_once_with_dedupe_key(
        &mut self,
        dedupe_key: &str,
        channel: &str,
        key: &str,
        value: &[u8],
        active_channel: Option<&str>,
    ) -> impl Future<Output = Result<bool>> + Send;

    /// Acknowledge a message which was published once with dedupe key
    fn ack_once(
        &mut self,
        dedupe_key: &str,
        channel: &str,
        group: &str,
        key: &str,
        active_channel: Option<&str>,
    ) -> impl Future<Output = Result<()>> + Send;

    /// Get messages from a channel
    fn messages(
        &mut self,
        channel: &str,
        group: &str,
        consumer: &str,
        keys: Option<&str>,
        max_messages: usize,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    /// Get messages from a channel
    fn messages_with_dedupe_key(
        &mut self,
        channel: &str,
        group: &str,
        consumer: &str,
        keys: Option<&str>,
        max_messages: usize,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    /// Get messages from a channel before a specific key
    fn get_messages_before(
        &mut self,
        channel: &str,
        id: &str,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    /// Get messages from a channel after a specific key
    fn get_messages_from(
        &mut self,
        channel: &str,
        id: &str,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    /// Get the last message from a channel
    fn last_message(
        &mut self,
        channel: &str,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<(String, Vec<u8>)>> + Send;

    /// Get the length of a channel
    fn length(&mut self, channel: &str) -> impl Future<Output = Result<usize>> + Send;
}
