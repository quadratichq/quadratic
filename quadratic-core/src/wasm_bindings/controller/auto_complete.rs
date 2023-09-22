use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Rect};

#[wasm_bindgen]
impl GridController {
    /// Expand the contents of the selected rectangle up to the specified row.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expand")]
    pub fn js_expand(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        range: &Rect,
        shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)?;
        let output = self
            .expand(sheet_id, *rect, *range, shrink_horizontal, cursor)
            .map_err(|e| e.to_string())?;
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
