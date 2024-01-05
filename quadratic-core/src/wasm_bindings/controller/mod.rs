use uuid::Uuid;

use super::*;
use crate::controller::transaction::TransactionServer;
use crate::controller::transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells};
use crate::{controller::transaction_summary::TransactionSummary, grid::js_types::*};
use std::str::FromStr;

pub mod auto_complete;
pub mod borders;
pub mod bounds;
pub mod cells;
pub mod clipboard;
pub mod export;
pub mod formatting;
pub mod import;
pub mod render;
pub mod sheet_offsets;
pub mod sheets;
pub mod summarize;

#[wasm_bindgen]
impl GridController {
    /// Imports a [`GridController`] from a JSON string.
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(file: &str, last_sequence_num: u32) -> Result<GridController, JsValue> {
        Ok(GridController::from_grid(
            file::import(file).map_err(|e| e.to_string())?,
            last_sequence_num as u64,
        ))
    }

    /// Exports a [`GridController`] to a file. Returns a `String`.
    #[wasm_bindgen(js_name = "exportToFile")]
    pub fn js_export_to_file(&mut self) -> Result<String, JsValue> {
        Ok(file::export(self.grid_mut()).map_err(|e| e.to_string())?)
    }

    /// Exports a [`string`]
    #[wasm_bindgen(js_name = "getVersion")]
    pub fn js_file_version(&self) -> String {
        file::CURRENT_VERSION.into()
    }

    /// Constructs a new empty grid.
    #[wasm_bindgen(constructor)]
    pub fn js_new() -> Self {
        Self::new()
    }

    /// Returns whether there is a transaction to undo.
    #[wasm_bindgen(js_name = "hasUndo")]
    pub fn js_has_undo(&self) -> bool {
        self.has_undo()
    }

    /// Returns whether there is a transaction to redo.
    #[wasm_bindgen(js_name = "hasRedo")]
    pub fn js_has_redo(&self) -> bool {
        self.has_redo()
    }

    /// Undoes one transaction. Returns a [`TransactionSummary`], or `null` if
    /// there was nothing to undo.
    #[wasm_bindgen(js_name = "undo")]
    pub fn js_undo(&mut self, cursor: Option<String>) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.undo(cursor))?)
    }
    /// Redoes one transaction. Returns a [`TransactionSummary`], or `null` if
    /// there was nothing to redo.
    #[wasm_bindgen(js_name = "redo")]
    pub fn js_redo(&mut self, cursor: Option<String>) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.redo(cursor))?)
    }

    #[wasm_bindgen(js_name = "calculationComplete")]
    pub fn js_calculation_complete(&mut self, result: JsCodeResult) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.calculation_complete(result),
        )?)
    }

    // TODO: this will not work with PendingTransaction
    #[wasm_bindgen(js_name = "getCalculationTransactionSummary")]
    pub fn js_calculation_transaction_summary(&mut self) -> Result<JsValue, JsValue> {
        // self.transaction_updated_bounds();
        // let summary = self.prepare_transaction_summary();
        let summary = TransactionSummary::default();
        Ok(serde_wasm_bindgen::to_value(&summary)?)
    }

    // todo: this should be reworked with ts-rs. also need better error return error to TS
    #[wasm_bindgen(js_name = "calculationGetCells")]
    pub fn js_calculation_get_cells(
        &mut self,
        get_cells: JsComputeGetCells,
    ) -> Option<CellsForArray> {
        self.calculation_get_cells(get_cells).ok()
    }

    #[wasm_bindgen(js_name = "multiplayerTransaction")]
    pub fn js_multiplayer_transaction(
        &mut self,
        transaction_id: String,
        sequence_num: u32,
        operations: String,
    ) -> Result<JsValue, JsValue> {
        let transaction_id = match Uuid::parse_str(&transaction_id) {
            Ok(transaction_id) => transaction_id,
            Err(e) => return Err(JsValue::from_str(&format!("Invalid transaction id: {}", e))),
        };
        let operations = match serde_json::from_str(&operations) {
            Ok(operations) => operations,
            Err(e) => return Err(JsValue::from_str(&format!("Invalid operations: {}", e))),
        };
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
        transactions: String,
    ) -> Result<JsValue, JsValue> {
        dbgjs!("1");
        let transactions: Vec<TransactionServer> = serde_json::from_str(&transactions)
            .expect("Invalid transactions received in receiveMultiplayerTransactions");
        dbgjs!("2");
        Ok(serde_wasm_bindgen::to_value(
            &self.received_transactions(&transactions[..]),
        )?)
    }
}
