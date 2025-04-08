use super::multiplayer::transaction::{ReceiveTransaction, ReceiveTransactions};
use crate::error::{MpError, Result};
use crate::message::response::{BinaryTransaction, MessageResponse};

use prost::Message;

pub(crate) fn encode_message(message: MessageResponse) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();

    match message {
        MessageResponse::BinaryTransaction { .. } => {
            let transaction = ReceiveTransaction::try_from(message)?;

            transaction
                .encode(&mut buffer)
                .map_err(|e| MpError::Unknown(e.to_string()))?;
        }
        MessageResponse::BinaryTransactions { transactions } => {
            let transactions = transactions
                .into_iter()
                .map(|transaction| transaction.try_into())
                .collect::<Result<Vec<ReceiveTransaction>>>()?;

            let response = ReceiveTransactions {
                r#type: "BinaryTransactions".to_string(),
                transactions,
            };

            response
                .encode(&mut buffer)
                .map_err(|e| MpError::Unknown(e.to_string()))?;
        }
        _ => {
            return Err(MpError::Unknown("Invalid message response".to_string()));
        }
    };

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
            } => ReceiveTransaction {
                r#type: "BinaryTransaction".to_string(),
                id: id.to_string(),
                file_id: file_id.to_string(),
                sequence_num,
                operations,
            },
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

impl TryFrom<BinaryTransaction> for ReceiveTransaction {
    type Error = MpError;

    fn try_from(message_response: BinaryTransaction) -> Result<Self> {
        message_response.try_into()
    }
}
