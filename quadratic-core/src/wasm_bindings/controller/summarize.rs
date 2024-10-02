use crate::selection::Selection;
use crate::wasm_bindings::GridController;
use serde::Serialize;
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Debug, ts_rs::TS, Serialize, PartialEq)]
pub struct SummarizeSelectionResult {
    pub count: i64,
    pub sum: Option<f64>,
    pub average: Option<f64>,
}

#[wasm_bindgen]
impl GridController {
    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "summarizeSelection")]
    pub fn js_summarize_selection(
        &mut self,
        selection: String,
        max_decimals: i64,
    ) -> Option<String> {
        let Ok(selection) = serde_json::from_str::<Selection>(&selection) else {
            dbgjs!("Unable to parse selection in core.summarizeSelection");
            return None;
        };
        let sheet = self.try_sheet(selection.sheet_id)?;
        let summary = sheet.summarize_selection(selection, max_decimals);
        match serde_json::to_string(&summary) {
            Ok(s) => Some(s),
            Err(e) => {
                dbgjs!(format!("Error serializing summary: {:?}", e));
                None
            }
        }
    }
}
