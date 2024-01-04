pub mod redis;

use crate::error::Result;
use crate::pubsub::redis::RedisConfig;

pub enum Config {
    Redis(RedisConfig),
}

pub trait PubSub {
    type Connection;

    async fn new(config: Config) -> Result<Self::Connection>;
    async fn connect(config: Config) -> Result<Self::Connection>;
    async fn subscribe(&mut self, channel: &str) -> Result<()>;
    async fn publish(&mut self, channel: &str, message: &str) -> Result<()>;
    async fn get_message(&mut self) -> Result<Option<String>>;
}
