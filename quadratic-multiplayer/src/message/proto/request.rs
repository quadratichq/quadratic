use prost::Message;
use quadratic_rust_shared::protobuf::quadratic::transaction::SendTransaction;

use crate::error::Result;

pub(crate) fn decode_transaction(b: &[u8]) -> Result<SendTransaction> {
    let transaction = Message::decode(b)?;
    Ok(transaction)
}
