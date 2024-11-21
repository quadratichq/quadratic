use crate::wasm_bindings::GridController;
use crate::A1Selection;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Debug, ts_rs::TS, Serialize, PartialEq)]
#[wasm_bindgen]
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
    ) -> Option<SummarizeSelectionResult> {
        let Ok(selection) = serde_json::from_str::<A1Selection>(&selection) else {
            dbgjs!("Unable to parse selection in core.summarizeSelection");
            return None;
        };
        let sheet = self.try_sheet(selection.sheet_id)?;
        sheet.summarize_selection(selection, max_decimals)
    }
}
