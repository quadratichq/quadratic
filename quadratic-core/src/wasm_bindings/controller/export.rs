use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::a1::A1Selection;
use crate::controller::GridController;

#[wasm_bindgen]
impl GridController {
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "exportCsvSelection")]
    pub fn js_export_csv_selection(&self, selection: String) -> Result<String, JsValue> {
        let mut selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let output = self
            .export_csv_selection(&mut selection)
            .map_err(|e| e.to_string())?;
        Ok(output)
    }
}

#[wasm_bindgen]
impl GridController {
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "exportExcel")]
    pub fn js_export_excel(&self) -> Result<Vec<u8>, JsValue> {
        match self.export_excel() {
            Ok(file) => Ok(file),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }
}
