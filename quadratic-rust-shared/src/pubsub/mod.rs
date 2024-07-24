pub mod redis;
pub mod redis_streams;

use futures_util::Future;

use crate::error::Result;
use crate::pubsub::redis::RedisConfig;
use crate::pubsub::redis_streams::RedisStreamsConfig;

#[derive(Debug, Clone)]
pub enum Config {
    Redis(RedisConfig),
    RedisStreams(RedisStreamsConfig),
}

pub trait PubSub {
    type Connection;

    fn new(config: Config) -> impl Future<Output = Result<Self::Connection>> + Send;

    fn connect(config: Config) -> impl Future<Output = Result<Self::Connection>> + Send;

    fn is_healthy(&mut self) -> impl Future<Output = bool> + Send;

    fn channels(&mut self) -> impl Future<Output = Result<Vec<String>>> + Send;

    fn active_channels(
        &mut self,
        channel: &str,
    ) -> impl Future<Output = Result<Vec<String>>> + Send;

    fn upsert_active_channel(
        &mut self,
        set_key: &str,
        channel: &str,
    ) -> impl Future<Output = Result<()>> + Send;

    fn remove_active_channel(
        &mut self,
        set_key: &str,
        channel: &str,
    ) -> impl Future<Output = Result<()>> + Send;

    fn subscribe(&mut self, channel: &str, group: &str) -> impl Future<Output = Result<()>> + Send;

    fn publish(
        &mut self,
        channel: &str,
        key: &str,
        value: &[u8],
        active_channel: Option<&str>,
    ) -> impl Future<Output = Result<()>> + Send;

    fn ack(
        &mut self,
        channel: &str,
        group: &str,
        keys: Vec<&str>,
        active_channel: Option<&str>,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<()>> + Send;

    fn trim(&mut self, channel: &str, key: &str) -> impl Future<Output = Result<i64>> + Send;

    fn messages(
        &mut self,
        channel: &str,
        group: &str,
        consumer: &str,
        keys: Option<&str>,
        max_messages: usize,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    fn get_messages_before(
        &mut self,
        channel: &str,
        id: &str,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    fn get_messages_from(
        &mut self,
        channel: &str,
        id: &str,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<Vec<(String, Vec<u8>)>>> + Send;

    fn last_message(
        &mut self,
        channel: &str,
        preserve_sequence: bool,
    ) -> impl Future<Output = Result<(String, Vec<u8>)>> + Send;
}
