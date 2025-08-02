use crate::error::{CoreCloudError, Result};

use prost::Message;
use quadratic_rust_shared::protobuf::quadratic::transaction::ScheduledTask as ScheduledTaskProto;

pub(crate) fn decode_scheduled_task(b: &[u8]) -> Result<ScheduledTaskProto> {
    let scheduled_task = Message::decode(b)?;
    Ok(scheduled_task)
}
