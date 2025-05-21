use crate::error::{MpError, Result};
use crate::message::request::MessageRequest;
use crate::message::response::MessageResponse;

use prost::Message;
use quadratic_rust_shared::protobuf::quadratic::transaction::SendTransaction;

pub(crate) fn decode_transaction(b: &[u8]) -> Result<SendTransaction> {
    let transaction = Message::decode(b)?;
    Ok(transaction)
}

impl TryFrom<SendTransaction> for MessageRequest {
    type Error = MpError;

    fn try_from(transaction: SendTransaction) -> Result<Self> {
        Ok(MessageRequest::BinaryTransaction {
            id: transaction.id.parse()?,
            session_id: transaction.session_id.parse()?,
            file_id: transaction.file_id.parse()?,
            operations: transaction.operations,
        })
    }
}

impl TryFrom<SendTransaction> for MessageResponse {
    type Error = MpError;

    fn try_from(transaction: SendTransaction) -> Result<Self> {
        Ok(MessageResponse::BinaryTransaction {
            id: transaction.id.parse()?,
            file_id: transaction.file_id.parse()?,
            sequence_num: 0, // This will be set by the server
            operations: transaction.operations,
        })
    }
}
