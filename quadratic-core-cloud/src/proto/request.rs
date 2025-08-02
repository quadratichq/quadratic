use crate::error::{CoreCloudError, Result};
use crate::state::pubsub::ScheduledTask;

use prost::Message;
use prost_types::Timestamp;
use quadratic_rust_shared::protobuf::quadratic::transaction::ScheduledTask as ScheduledTaskProto;
use std::time::SystemTime;

/// Encode a single scheduled task into a protobuf message
pub(crate) fn encode_scheduled_task(scheduled_task: ScheduledTaskProto) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    scheduled_task
        .encode(&mut buffer)
        .map_err(|e| CoreCloudError::Serialization(e.to_string()))?;

    Ok(buffer)
}

impl From<ScheduledTask> for ScheduledTaskProto {
    fn from(transaction: ScheduledTask) -> Self {
        ScheduledTaskProto {
            r#type: "ScheduledTask".to_string(),
            id: transaction.id.to_string(),
            file_id: transaction.file_id.to_string(),
            operations: transaction.operations,
            start_datetime: Some(Timestamp::from(SystemTime::from(
                transaction.start_datetime,
            ))),
            end_datetime: transaction
                .end_datetime
                .map(|d| Timestamp::from(SystemTime::from(d))),
            frequency_minutes: transaction.frequency_minutes,
        }
    }
}
