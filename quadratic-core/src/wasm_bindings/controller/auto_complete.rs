use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Rect};

#[wasm_bindgen]
impl GridController {
    /// Expand the contents of the selected rectangle down to the specified row.
    /// If the rectangle changes proportions from the
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expandDown")]
    pub fn js_expand_down(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        to: u32,
        shrink_horizontal: Option<u32>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.expand_down(sheet_id, *rect, to, shrink_horizontal);
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
