use super::multiplayer::transaction::SendTransaction;
use crate::error::{MpError, Result};
use crate::message::request::MessageRequest;

use prost::Message;

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
