//! Websocket Message Responses
//!
//! A central place for websocket messages responses.

use crate::error::Result;
use prost::Message;

use quadratic_rust_shared::protobuf::quadratic::transaction::{
    Error, ShutdownCoreCloudAck, StartupCoreCloudAck, TransactionAck,
};

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum MessageResponse {
    StartupCoreCloudAck(StartupCoreCloudAck),
    TransactionAck(TransactionAck),
    ShutdownCoreCloudAck(ShutdownCoreCloudAck),
    Error(Error),
}

impl MessageResponse {
    pub(crate) fn encode(&self) -> Result<Vec<u8>> {
        match self {
            MessageResponse::StartupCoreCloudAck(message) => Ok(message.encode_to_vec()),
            MessageResponse::TransactionAck(message) => Ok(message.encode_to_vec()),
            MessageResponse::ShutdownCoreCloudAck(message) => Ok(message.encode_to_vec()),
            MessageResponse::Error(message) => Ok(message.encode_to_vec()),
        }
    }
}
