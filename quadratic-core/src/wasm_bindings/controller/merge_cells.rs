use super::*;

#[wasm_bindgen]
impl GridController {
    /// Merges cells for the selection within a rectangle.
    #[wasm_bindgen(js_name = "mergeCells")]
    pub fn js_merge_cells(
        &mut self,
        selection: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let selection =
                serde_json::from_str(&selection).map_err(|e| format!("Invalid selection: {e}"))?;

            self.merge_cells(selection, cursor, is_ai);
            Ok(None)
        })
    }
}
