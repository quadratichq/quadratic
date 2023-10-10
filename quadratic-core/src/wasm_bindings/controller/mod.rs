use super::*;
use crate::{controller::transaction_summary::TransactionSummary, grid::js_types::*};
use std::str::FromStr;

pub mod auto_complete;
pub mod bounds;
pub mod cells;
pub mod clipboard;
pub mod formatting;
pub mod import;
pub mod render;
pub mod sheet_offsets;
pub mod sheets;

#[wasm_bindgen]
impl GridController {
    /// Imports a [`GridController`] from a JSON string.
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(file: &str) -> Result<GridController, JsValue> {
        Ok(GridController::from_grid(file::import(file)?))
    }

    /// Exports a [`GridController`] to a file. Returns a `String`.
    #[wasm_bindgen(js_name = "exportToFile")]
    pub fn js_export_to_file(&self) -> Result<String, JsValue> {
        Ok(file::export(self.grid())?)
    }

    /// Exports a [`string`]
    #[wasm_bindgen(js_name = "getVersion")]
    pub fn js_file_version(&self) -> String {
        file::version()
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

    /// Populates a portion of a sheet with random float values.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "populateWithRandomFloats")]
    pub fn js_populate_with_random_floats(
        &mut self,
        sheet_id: String,
        region: &Rect,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        self.populate_with_random_floats(sheet_id, region);
        Ok(serde_wasm_bindgen::to_value(&TransactionSummary {
            fill_sheets_modified: vec![],
            border_sheets_modified: vec![],
            code_cells_modified: HashSet::new(),
            operations: vec![],
            sheet_list_modified: false,
            cursor: None,
            offsets_modified: vec![],
        })?)
    }
}
