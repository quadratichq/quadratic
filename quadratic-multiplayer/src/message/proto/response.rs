use crate::error::{MpError, Result};
use quadratic_rust_shared::multiplayer::message::response::MessageResponse;

use prost::Message;
use quadratic_rust_shared::protobuf::quadratic::transaction::{
    ReceiveTransaction, ReceiveTransactions,
};

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
                .map(|transaction| ReceiveTransaction {
                    r#type: "BinaryTransaction".to_string(),
                    id: transaction.id.to_string(),
                    file_id: transaction.file_id.to_string(),
                    sequence_num: transaction.sequence_num,
                    operations: transaction.operations,
                })
                .collect::<Vec<ReceiveTransaction>>();

            let response = ReceiveTransactions {
                r#type: "BinaryTransactions".to_string(),
                transactions,
            };

            encode_transactions(response)
        }
        _ => Err(MpError::ReceivingMessage(
            "Cannot encode message into protobuf".into(),
        )),
    }
}
