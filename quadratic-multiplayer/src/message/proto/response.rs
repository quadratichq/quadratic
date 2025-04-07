use super::multiplayer::transaction::ReceiveTransaction;
use crate::error::{MpError, Result};
use crate::message::response::MessageResponse;

use prost::Message;

pub(crate) fn encode_transaction(transaction: &ReceiveTransaction) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    transaction
        .encode(&mut buffer)
        .map_err(|e| MpError::Unknown(e.to_string()))?;

    Ok(buffer)
}

impl TryFrom<MessageResponse> for ReceiveTransaction {
    type Error = MpError;

    fn try_from(message_response: MessageResponse) -> Result<Self> {
        let transaction = match message_response {
            MessageResponse::BinaryTransaction {
                id,
                file_id,
                sequence_num,
                operations,
            } => {
                let mut transaction = ReceiveTransaction::default();
                transaction.id = id.to_string();
                transaction.file_id = file_id.to_string();
                transaction.sequence_num = sequence_num;
                transaction.operations = operations;
                transaction
            }
            _ => {
                return Err(MpError::Unknown(format!(
                    "Invalid message response: {:?}",
                    message_response
                )));
            }
        };

        Ok(transaction)
    }
}
