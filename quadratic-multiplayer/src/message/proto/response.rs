use crate::error::{MpError, Result};
use crate::message::response::{BinaryTransaction, MessageResponse};

use prost::Message;
use quadratic_rust_shared::protobuf::quadratic::transaction::{
    ReceiveTransaction, ReceiveTransactions,
};

<<<<<<< HEAD
pub(crate) fn encode_message(message: MessageResponse) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();

    match message {
        MessageResponse::BinaryTransaction { .. } => {
            let transaction = ReceiveTransaction::try_from(message)?;

            transaction
                .encode(&mut buffer)
                .map_err(|e| MpError::Serialization(e.to_string()))?;
        }
        MessageResponse::BinaryTransactions { transactions } => {
            let transactions = transactions
                .into_iter()
                .map(|transaction| transaction.try_into())
                .collect::<Result<Vec<ReceiveTransaction>>>()?;
=======
/// Encode a single transaction into a protobuf message
pub(crate) fn encode_transaction(transaction: ReceiveTransaction) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    transaction
        .encode(&mut buffer)
        .map_err(|e| MpError::Serialization(e.to_string()))?;

    Ok(buffer)
}

/// Encode a vec of transactions into a protobuf message
pub(crate) fn encode_transactions(transactions: ReceiveTransactions) -> Result<Vec<u8>> {
    let mut buffer = Vec::new();
    transactions
        .encode(&mut buffer)
        .map_err(|e| MpError::Serialization(e.to_string()))?;

    Ok(buffer)
}

/// Encode a message into a protobuf message
pub(crate) fn encode_message(message: MessageResponse) -> Result<Vec<u8>> {
    match message {
        MessageResponse::BinaryTransaction {
            id,
            file_id,
            sequence_num,
            operations,
        } => encode_transaction(ReceiveTransaction {
            r#type: "BinaryTransaction".to_string(),
            id: id.to_string(),
            file_id: file_id.to_string(),
            sequence_num,
            operations,
        }),
        MessageResponse::BinaryTransactions { transactions } => {
            let transactions = transactions
                .into_iter()
                .map(|transaction| transaction.into())
                .collect::<Vec<ReceiveTransaction>>();
>>>>>>> more-mp-tests-and-logs

            let response = ReceiveTransactions {
                r#type: "BinaryTransactions".to_string(),
                transactions,
            };

<<<<<<< HEAD
            response
                .encode(&mut buffer)
                .map_err(|e| MpError::Serialization(e.to_string()))?;
        }
        _ => {
            return Err(MpError::ReceivingMessage(
                "Invalid message response".to_string(),
            ));
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
                return Err(MpError::ReceivingMessage(format!(
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
=======
            encode_transactions(response)
        }
        _ => {
            Err(MpError::ReceivingMessage(
                "Cannot encode message into protobuf".into(),
            ))
        }
    }
}

impl From<BinaryTransaction> for ReceiveTransaction {
    fn from(binary_transaction: BinaryTransaction) -> Self {
        ReceiveTransaction {
            r#type: "BinaryTransaction".to_string(),
            id: binary_transaction.id.to_string(),
            file_id: binary_transaction.file_id.to_string(),
            sequence_num: binary_transaction.sequence_num,
            operations: binary_transaction.operations,
        }
>>>>>>> more-mp-tests-and-logs
    }
}
