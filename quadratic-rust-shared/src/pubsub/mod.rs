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
    async fn subscribe(&mut self, channel: &str, group: &str) -> Result<()>;
    async fn publish(&mut self, channel: &str, key: &str, value: &str) -> Result<()>;
    async fn ack(&mut self, channel: &str, keys: Vec<&str>) -> Result<()>;
    async fn messages(
        &mut self,
        channel: &str,
        group: &str,
        max_messages: usize,
    ) -> Result<Vec<(String, String)>>;
    // async fn poll<T>(&mut self) -> impl Stream;
}
