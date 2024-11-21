use crate::wasm_bindings::GridController;
use crate::A1Selection;
use wasm_bindgen::prelude::*;

use super::JsSummarizeSelectionResult;

#[wasm_bindgen]
impl GridController {
    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "summarizeSelection")]
    pub fn js_summarize_selection(
        &mut self,
        selection: String,
        max_decimals: i64,
    ) -> Option<JsSummarizeSelectionResult> {
        let Ok(selection) = serde_json::from_str::<A1Selection>(&selection) else {
            dbgjs!("Unable to parse selection in core.summarizeSelection");
            return None;
        };
        let sheet = self.try_sheet(selection.sheet_id)?;
        sheet.summarize_selection(selection, max_decimals)
    }
}
