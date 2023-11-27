use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Rect};

#[wasm_bindgen]
impl GridController {
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "exportCsvSelection")]
    pub fn js_export_csv_selection(
        &self,
        sheet_id: &str,
        selection: &Rect,
    ) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
        let output = self
            .export_csv_selection(sheet_id, selection)
            .map_err(|e| e.to_string())?;
        Ok(output)
    }
}
