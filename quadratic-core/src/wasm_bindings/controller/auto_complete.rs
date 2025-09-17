use std::str::FromStr;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::{
    Rect, controller::GridController, grid::SheetId, wasm_bindings::error::handle_core_result,
};

#[allow(non_snake_case)]
#[wasm_bindgen]
impl GridController {
    /// Extend and/or shrink the contents of selection to range by inferring patterns.
    #[wasm_bindgen(js_name = "autocomplete")]
    pub fn js_autocomplete(
        &mut self,
        sheet_id: String,
        initial_range: String,
        final_range: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        handle_core_result(|| -> Result<(), String> {
            let initial_range: Rect =
                serde_json::from_str(&initial_range).map_err(|e| e.to_string())?;
            let final_range: Rect =
                serde_json::from_str(&final_range).map_err(|e| e.to_string())?;
            let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
            self.autocomplete(sheet_id, initial_range, final_range, cursor, is_ai)
                .map_err(|e| e.to_string())
        });
        Ok(())
    }
}
