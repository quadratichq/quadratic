use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Rect};

#[wasm_bindgen]
impl GridController {
    /// Expand the contents of the selected rectangle down to the specified row.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expandDown")]
    pub fn js_expand_down(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        to: i64,
        shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        crate::wasm_bindings::js::log(&format!("expand_down *rect: {:?}", *rect));
        let output = self.expand_down(sheet_id, *rect, to, shrink_horizontal, cursor);
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    /// Expand the contents of the selected rectangle to the right to the specified row.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expandRight")]
    pub fn js_expand_right(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        to: i64,
        to_vertical: Option<i64>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.expand_right(sheet_id, *rect, to, to_vertical, cursor);
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
