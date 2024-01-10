pub mod redis;
pub mod redis_streams;

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

    async fn new(config: Config) -> Result<Self::Connection>;
    async fn connect(config: Config) -> Result<Self::Connection>;
    async fn channels(&mut self) -> Result<Vec<String>>;
    async fn active_channels(&mut self, channel: &str) -> Result<Vec<String>>;
    async fn upsert_active_channel(&mut self, set_key: &str, channel: &str) -> Result<()>;
    async fn remove_active_channel(&mut self, set_key: &str, channel: &str) -> Result<()>;
    async fn subscribe(&mut self, channel: &str, group: &str) -> Result<()>;
    async fn publish(
        &mut self,
        channel: &str,
        key: &str,
        value: &str,
        active_channel: Option<&str>,
    ) -> Result<()>;
    async fn ack(&mut self, channel: &str, group: &str, keys: Vec<&str>) -> Result<()>;
    async fn messages(
        &mut self,
        channel: &str,
        group: &str,
        keys: Option<Vec<&str>>,
        max_messages: usize,
    ) -> Result<Vec<(String, String)>>;
    async fn get_messages_from(&mut self, channel: &str, id: &str)
        -> Result<Vec<(String, String)>>;
    async fn last_message(&mut self, channel: &str) -> Result<(String, String)>;
}
