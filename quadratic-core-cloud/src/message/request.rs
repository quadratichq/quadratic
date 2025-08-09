use quadratic_rust_shared::protobuf::{
    quadratic::transaction::{SendTransaction, ShutdownCoreCloud, StartupCoreCloud},
    utils::type_name_from_peek,
};

use crate::error::Result;

#[derive(Debug, PartialEq)]
pub(crate) enum MessageRequest {
    StartupCoreCloud(StartupCoreCloud),
    SendTransaction(SendTransaction),
    ShutdownCoreCloud(ShutdownCoreCloud),
}

impl MessageRequest {
    pub(crate) fn decode(data: &[u8]) -> Result<Self> {
        let msg_type = type_name_from_peek(data)?;
        Ok(msg_type.into())
    }
}

impl From<String> for MessageRequest {
    fn from(value: String) -> Self {
        match value.as_str() {
            "StartupCoreCloud" => MessageRequest::StartupCoreCloud(StartupCoreCloud::default()),
            "SendTransaction" => MessageRequest::SendTransaction(SendTransaction::default()),
            "ShutdownCoreCloud" => MessageRequest::ShutdownCoreCloud(ShutdownCoreCloud::default()),
            _ => panic!("Invalid message type: {}", value),
        }
    }
}
