use super::multiplayer::transaction::{ReceiveTransaction, ReceiveTransactions};
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

// pub(crate) fn encode_transactions(transactions: &[ReceiveTransaction]) -> Result<Vec<u8>> {
//     let mut buffer = Vec::new();

//     for transaction in transactions.iter() {
//         transaction
//             .encode(&mut buffer)
//             .map_err(|e| MpError::Unknown(e.to_string()))?;
//     }

//     Ok(buffer)
// }

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
