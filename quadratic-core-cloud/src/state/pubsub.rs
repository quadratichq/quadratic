use chrono::{DateTime, Utc};
use prost::Message;
use prost_types::Timestamp;
use quadratic_rust_shared::protobuf::quadratic::transaction::ScheduledTask as ScheduledTaskProto;
use quadratic_rust_shared::pubsub::{
    Config as PubSubConfig, PubSub as PubSubTrait, redis_streams::RedisConnection,
};
use uuid::Uuid;

use crate::{error::Result, state::State};

pub static GROUP_NAME: &str = "quadratic-core-cloud-1";

#[derive(Debug, Clone)]
pub(crate) struct ScheduledTask {
    pub(crate) id: Uuid,
    pub(crate) file_id: Uuid,
    pub(crate) operations: Vec<u8>,
    pub(crate) start_datetime: DateTime<Utc>,
    pub(crate) end_datetime: Option<DateTime<Utc>>,
    pub(crate) frequency_minutes: u64,
}

#[derive(Debug)]
pub(crate) struct PubSub {
    pub(crate) config: PubSubConfig,
    pub(crate) connection: RedisConnection,
}

impl PubSub {
    /// Create a new connection to the PubSub server
    pub(crate) async fn new(config: PubSubConfig) -> Result<Self> {
        let connection = Self::connect(&config).await?;
        Ok(PubSub { config, connection })
    }

    /// Connect to the PubSub server
    pub(crate) async fn connect(config: &PubSubConfig) -> Result<RedisConnection> {
        let connection = RedisConnection::new(config.to_owned()).await?;
        Ok(connection)
    }

    /// Check if the connection is healthy and attempt to reconnect if not
    pub(crate) async fn reconnect_if_unhealthy(&mut self) {
        let is_healthy = self.connection.is_healthy().await;

        if !is_healthy {
            tracing::error!("PubSub connection is unhealthy");

            match Self::connect(&self.config).await {
                Ok(connection) => {
                    self.connection = connection;
                    tracing::info!("PubSub connection is now healthy");
                }
                Err(error) => {
                    tracing::error!("Error reconnecting to PubSub {error}");
                }
            }
        }
    }

    pub(crate) async fn push_scheduled_task(
        &mut self,
        channel: &str,
        scheduled_task: ScheduledTask,
    ) -> Result<Uuid> {
        let id = scheduled_task.id;
        let key = scheduled_task.start_datetime.timestamp_millis().to_string();

        // turn BinaryTransaction into Protobuf
        let proto_task: ScheduledTaskProto = scheduled_task.into();
        let encoded = proto_task.encode_to_vec();

        // TODO(ddimaria): add header to the message
        // // add header to the message
        // let scheduled_task_compressed = Transaction::add_header(encoded)
        //     .map_err(|e| CoreCloudError::Serialization(e.to_string()))?;

        // publish the message to the PubSub server
        self.connection
            .publish(
                &channel.to_string(),
                &key, // Let Redis auto-generate the stream ID
                &encoded,
                None,
            )
            .await?;

        Ok(id)
    }
}

impl State {
    /// Subscribe to the PubSub channel
    pub(crate) async fn subscribe_pubsub(&self, channel: &str, group_name: &str) -> Result<()> {
        self.pubsub
            .lock()
            .await
            .connection
            .subscribe(channel.into(), group_name)
            .await?;

        Ok(())
    }

    /// Push a transaction to the transaction queue
    pub(crate) async fn push(&self, channel: &str, scheduled_task: ScheduledTask) -> Result<Uuid> {
        self.pubsub
            .lock()
            .await
            .push_scheduled_task(channel, scheduled_task)
            .await
    }
}

impl From<ScheduledTask> for ScheduledTaskProto {
    fn from(task: ScheduledTask) -> Self {
        ScheduledTaskProto {
            r#type: "ScheduledTask".to_string(),
            id: task.id.to_string(),
            file_id: task.file_id.to_string(),
            operations: task.operations,
            start_datetime: Some(Timestamp {
                seconds: task.start_datetime.timestamp(),
                nanos: task.start_datetime.timestamp_subsec_nanos() as i32,
            }),
            end_datetime: task.end_datetime.map(|dt| Timestamp {
                seconds: dt.timestamp(),
                nanos: dt.timestamp_subsec_nanos() as i32,
            }),
            frequency_minutes: task.frequency_minutes,
        }
    }
}

#[cfg(test)]
mod tests {
    // use super::*;
}
