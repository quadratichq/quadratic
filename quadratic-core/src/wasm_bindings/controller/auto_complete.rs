use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Rect};

#[wasm_bindgen]
impl GridController {
    /// Extend and/or shrink the contents of selection to range by inferring patterns.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expand")]
    pub async fn js_expand(
        &mut self,
        sheet_id: String,
        selection: &Rect,
        range: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)?;
        let output = self
            .expand(sheet_id, *selection, *range, cursor)
            .await
            .map_err(|e| e.to_string())?;
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
