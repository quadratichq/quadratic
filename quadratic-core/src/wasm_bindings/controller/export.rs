use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::grid::SheetId;
use crate::{controller::GridController, A1Selection, SheetNameIdMap};

#[wasm_bindgen]
impl GridController {
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "exportCsvSelection")]
    pub fn js_export_csv_selection(
        &self,
        selection: String,
        sheet_id: String,
        sheet_map: String,
    ) -> Result<String, JsValue> {
        let sheet_id = serde_json::from_str::<SheetId>(&sheet_id).map_err(|e| e.to_string())?;
        let sheet_map =
            serde_json::from_str::<SheetNameIdMap>(&sheet_map).map_err(|e| e.to_string())?;
        let selection =
            A1Selection::from_str(&selection, &sheet_id, &sheet_map).map_err(|e| e.to_string())?;
        let output = self
            .export_csv_selection(selection)
            .map_err(|e| e.to_string())?;
        Ok(output)
    }
}
