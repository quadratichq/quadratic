use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::a1::A1Selection;
use crate::wasm_bindings::GridController;

#[wasm_bindgen]
impl GridController {
    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "summarizeSelection")]
    pub fn js_summarize_selection(
        &self,
        selection: String,
        max_decimals: i64,
    ) -> Result<JsValue, JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        if let Some(sheet) = self.try_sheet(selection.sheet_id) {
            let selection_summary =
                sheet.summarize_selection(selection, max_decimals, self.a1_context());
            Ok(serde_wasm_bindgen::to_value(&selection_summary).map_err(|e| e.to_string())?)
        } else {
            Ok(JsValue::null())
        }
    }
}
