use super::*;
use crate::controller::{
    active_transactions::unsaved_transactions::UnsavedTransaction,
    operations::operation::Operation,
    transaction::{Transaction, TransactionServer},
};
use uuid::Uuid;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "multiplayerTransaction")]
    pub fn js_multiplayer_transaction(
        &mut self,
        transaction_id: String,
        sequence_num: u32,
        operations: &[u8],
    ) -> Result<JsValue, JsValue> {
        let transaction_id = Uuid::parse_str(&transaction_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid transaction id: {}", e)))?;

        let operations = Transaction::decompress_and_deserialize::<Vec<Operation>>(operations)
            .map_err(|e| JsValue::from_str(&format!("Invalid operations: {}", e)))?;

        Ok(serde_wasm_bindgen::to_value(&self.received_transaction(
            transaction_id,
            sequence_num as u64,
            operations,
        ))?)
    }

    /// Used to set the sequence_num for multiplayer. This should only be called when receiving the sequence_num
    /// directly from the file. Use receiveSequenceNum for all other cases.
    #[wasm_bindgen(js_name = "setMultiplayerSequenceNum")]
    pub fn js_multiplayer_set_sequence_num(&mut self, sequence_num: u32) {
        self.set_last_sequence_num(sequence_num as u64);
    }

    /// Handle server-provided sequence_num.
    ///
    /// Returns a [`TransactionSummary`] (sometimes with a request for more transactions)
    #[wasm_bindgen(js_name = "receiveSequenceNum")]
    pub fn js_receive_sequence_num(&mut self, sequence_num: u32) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.receive_sequence_num(sequence_num as u64),
        )?)
    }

    #[wasm_bindgen(js_name = "receiveMultiplayerTransactions")]
    pub fn js_receive_multiplayer_transactions(
        &mut self,
        transactions: JsValue,
    ) -> Result<JsValue, JsValue> {
        match serde_wasm_bindgen::from_value::<Vec<TransactionServer>>(transactions) {
            Ok(transactions) => Ok(serde_wasm_bindgen::to_value(
                &self.received_transactions(transactions),
            )?),
            Err(e) => Err(JsValue::from_str(&format!(
                "Invalid transactions received in receiveMultiplayerTransactions: {e}"
            ))),
        }
    }

    #[wasm_bindgen(js_name = "receiveMultiplayerTransactionAck")]
    pub fn js_receive_multiplayer_transaction_ack(
        &mut self,
        transaction_id: String,
        sequence_num: u32,
    ) -> Result<JsValue, JsValue> {
        let transaction_id = Uuid::parse_str(&transaction_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid transaction id: {}", e)))?;

        self.received_transaction(transaction_id, sequence_num as u64, vec![]);

        Ok(serde_wasm_bindgen::to_value(&JsResponse {
            result: true,
            error: None,
        })?)
    }

    #[wasm_bindgen(js_name = "applyOfflineUnsavedTransaction")]
    pub fn js_apply_offline_unsaved_transaction(
        &mut self,
        transaction_id: String,
        unsaved_transaction: String,
    ) -> Result<JsValue, JsValue> {
        let transaction_id = match Uuid::parse_str(&transaction_id) {
            Ok(transaction_id) => transaction_id,
            Err(e) => {
                return Ok(serde_wasm_bindgen::to_value(&JsResponse {
                    result: false,
                    error: Some(format!(
                        "Invalid transaction id: {:?}, error: {:?}",
                        transaction_id, e
                    )),
                })?);
            }
        };
        match serde_json::from_str::<UnsavedTransaction>(&unsaved_transaction) {
            Ok(unsaved_transaction) => {
                self.apply_offline_unsaved_transaction(transaction_id, unsaved_transaction);
                Ok(serde_wasm_bindgen::to_value(&JsResponse {
                    result: true,
                    error: None,
                })?)
            }
            Err(e) => {
                dbgjs!(format!(
                    "Invalid unsaved transaction received in applyOfflineUnsavedTransaction {:?}, error: {:?}",
                    unsaved_transaction, e
                ));
                Ok(serde_wasm_bindgen::to_value(&JsResponse {
                    result: false,
                    error: Some(format!(
                        "Invalid unsaved transaction received in applyOfflineUnsavedTransaction {:?}, error: {:?}",
                        unsaved_transaction, e
                    )),
                })?)
            }
        }
    }
}
