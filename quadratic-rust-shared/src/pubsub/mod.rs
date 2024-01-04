pub mod redis;

use futures_util::Stream;

use crate::error::Result;
use crate::pubsub::redis::RedisConfig;

#[derive(Debug, Clone)]
pub enum Config {
    Redis(RedisConfig),
}

pub trait PubSub {
    type Connection;

    async fn new(config: Config) -> Result<Self::Connection>;
    async fn connect(config: Config) -> Result<Self::Connection>;
    async fn subscribe(&mut self, channel: &str) -> Result<()>;
    async fn publish(&mut self, channel: &str, message: &str) -> Result<()>;
    async fn poll<T>(&mut self) -> impl Stream;
}
