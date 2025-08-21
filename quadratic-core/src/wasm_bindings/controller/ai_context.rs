use std::collections::HashMap;

use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::a1::A1Selection;
use crate::controller::GridController;

#[wasm_bindgen]
impl GridController {
    /// Returns the context for ai in selection. If max_rows is not provided, then it does not provide sample rows
    /// returns an array of JsSelectionContext, one for each selection
    #[wasm_bindgen(js_name = "getAISelectionContexts")]
    pub fn js_ai_selection_contexts(
        &self,
        selections: Vec<String>,
        max_rows: Option<usize>,
    ) -> Result<JsValue, JsValue> {
        let selections = selections
            .iter()
            .map(|selection| serde_json::from_str::<A1Selection>(selection))
            .collect::<Result<Vec<A1Selection>, _>>()
            .map_err(|_| JsValue::from_str("Unable to parse A1Selection"))?;

        let mut selection_contexts = Vec::new();
        for selection in selections {
            let Some(sheet) = self.try_sheet(selection.sheet_id) else {
                continue;
            };

            let selection_context =
                sheet.get_ai_selection_context(selection, max_rows, self.a1_context());
            selection_contexts.push(selection_context);
        }
        serde_wasm_bindgen::to_value(&selection_contexts).map_err(|e| {
            dbgjs!(format!(
                "[ai_context.rs] error occurred while serializing selection_contexts: {:?}",
                e
            ));
            JsValue::UNDEFINED
        })
    }

    /// Returns all code cells with errors or spills in all sheets. Returns
    /// undefined if there are no errors or spills in the file.
    #[wasm_bindgen(js_name = "getAICodeErrors")]
    pub fn js_get_ai_code_errors(&self, max_errors: usize) -> Result<JsValue, JsValue> {
        let mut errors = HashMap::new();

        for sheet in self.grid().sheets().values() {
            let sheet_errors = sheet.get_ai_code_errors(max_errors);
            if !sheet_errors.is_empty() {
                errors.insert(sheet.name.clone(), sheet_errors);
            }
        }
        if errors.is_empty() {
            Ok(JsValue::UNDEFINED)
        } else {
            serde_wasm_bindgen::to_value(&errors).map_err(|e| {
                dbgjs!(format!(
                    "[ai_context.rs] error occurred while serializing code errors: {:?}",
                    e
                ));
                JsValue::UNDEFINED
            })
        }
    }
}
