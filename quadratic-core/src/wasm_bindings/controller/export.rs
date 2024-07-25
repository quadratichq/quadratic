use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, selection::Selection};

#[wasm_bindgen]
impl GridController {
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "exportCsvSelection")]
    pub fn js_export_csv_selection(&self, selection: String) -> Result<String, JsValue> {
        let selection = Selection::from_str(&selection).map_err(|e| e.to_string())?;
        let output = self
            .export_csv_selection(selection)
            .map_err(|e| e.to_string())?;
        Ok(output)
    }
}
