use std::collections::HashMap;

use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::wasm_bindings::capture_core_error;

#[wasm_bindgen]
impl GridController {
    /// Returns the context for ai in selection. If max_rows is not provided, then it does not provide sample rows
    /// returns an array of JsSelectionContext, one for each selection
    #[wasm_bindgen(js_name = "getAISelectionContexts")]
    pub fn js_ai_selection_contexts(
        &self,
        selections: Vec<String>,
        max_rows: Option<usize>,
    ) -> JsValue {
        capture_core_error(|| {
            let selections = match selections
                .iter()
                .map(|selection| serde_json::from_str::<A1Selection>(selection))
                .collect::<Result<Vec<A1Selection>, _>>()
            {
                Ok(selections) => selections,
                Err(_) => {
                    dbgjs!(format!(
                        "[ai_context.rs] error occurred while parsing A1Selection: {selections:?}"
                    ));
                    return Ok(Some(JsValue::UNDEFINED));
                }
            };

            let mut selection_contexts = Vec::new();
            for selection in selections {
                let Some(sheet) = self.try_sheet(selection.sheet_id) else {
                    continue;
                };

                let selection_context =
                    sheet.get_ai_selection_context(selection, max_rows, self.a1_context());
                selection_contexts.push(selection_context);
            }

            match serde_wasm_bindgen::to_value(&selection_contexts) {
                Ok(value) => Ok(Some(value)),
                Err(e) => {
                    dbgjs!(format!(
                        "[ai_context.rs] error occurred while serializing selection_contexts: {e:?}"
                    ));
                    Ok(Some(JsValue::UNDEFINED))
                }
            }
        })
    }

    /// Returns all code cells with errors or spills in all sheets. Returns
    /// undefined if there are no errors or spills in the file.
    #[wasm_bindgen(js_name = "getAICodeErrors")]
    pub fn js_get_ai_code_errors(&self, max_errors: usize) -> JsValue {
        capture_core_error(|| {
            let mut errors = HashMap::new();
            for sheet in self.grid().sheets().values() {
                let sheet_errors = sheet.get_ai_code_errors(max_errors);
                if !sheet_errors.is_empty() {
                    errors
                        .entry(sheet.name.clone())
                        .or_insert_with(Vec::new)
                        .extend(sheet_errors);
                }
            }

            if errors.is_empty() {
                Ok(Some(JsValue::UNDEFINED))
            } else {
                match serde_wasm_bindgen::to_value(&errors) {
                    Ok(value) => Ok(Some(value)),
                    Err(e) => {
                        dbgjs!(format!(
                            "[ai_context.rs] error occurred while serializing code errors: {e:?}"
                        ));
                        Ok(Some(JsValue::UNDEFINED))
                    }
                }
            }
        })
    }

    /// Extracts a MemoryPayload from the current grid state for AI memory
    /// summarization. Returns the full file structure and all code cells.
    #[wasm_bindgen(js_name = "getMemoryPayload")]
    pub fn js_get_memory_payload(&self) -> JsValue {
        capture_core_error(|| {
            let payload = self.extract_memory_payload();
            match serde_wasm_bindgen::to_value(&payload) {
                Ok(value) => Ok(Some(value)),
                Err(e) => {
                    dbgjs!(format!(
                        "[ai_context.rs] error occurred while serializing memory payload: {e:?}"
                    ));
                    Ok(Some(JsValue::UNDEFINED))
                }
            }
        })
    }

    #[wasm_bindgen(js_name = "getAITransactions")]
    pub fn js_get_ai_transactions(&self) -> JsValue {
        capture_core_error(|| {
            let transactions = self.get_tracked_transactions();
            match serde_wasm_bindgen::to_value(transactions) {
                Ok(value) => Ok(Some(value)),
                Err(e) => {
                    dbgjs!(format!(
                        "[ai_context.rs] error occurred while serializing ai transactions: {e:?}"
                    ));
                    Ok(Some(JsValue::UNDEFINED))
                }
            }
        })
    }
}
