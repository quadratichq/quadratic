use super::*;
use crate::controller::transaction_types::{JsCodeResult, JsComputeGetCells};
use crate::grid::js_types::*;
use std::str::FromStr;

pub mod auto_complete;
pub mod borders;
pub mod bounds;
pub mod cells;
pub mod clipboard;
pub mod code;
pub mod export;
pub mod formatting;
pub mod import;
pub mod render;
pub mod sheet_offsets;
pub mod sheets;
pub mod summarize;
pub mod transactions;

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

    #[wasm_bindgen(js_name = "test")]
    pub fn js_test() -> GridController {
        GridController::test()
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
}
