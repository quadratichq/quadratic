use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Rect};

#[wasm_bindgen]
impl GridController {
    /// Expand the contents of the selected rectangle up to the specified row.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expandUp")]
    pub fn js_expand_up(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        to: i64,
        shrink_horizontal: Option<i64>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)?;
        let output = self
            .expand_up(sheet_id, *rect, to, shrink_horizontal, cursor)
            .map_err(|e| e.to_string())?;
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

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
        let sheet_id = SheetId::from_str(&sheet_id)?;
        let output = self
            .expand_down(sheet_id, *rect, to, shrink_horizontal, cursor)
            .map_err(|e| e.to_string())?;
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    /// Expand the contents of the selected rectangle to the left to the specified row.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "expandLeft")]
    pub fn js_expand_left(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        to: i64,
        to_vertical: Option<i64>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)?;
        let output = self
            .expand_left(sheet_id, *rect, to, to_vertical, cursor)
            .map_err(|e| e.to_string())?;
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
        let sheet_id = SheetId::from_str(&sheet_id)?;
        let output = self
            .expand_right(sheet_id, *rect, to, to_vertical, cursor)
            .map_err(|e| e.to_string())?;
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
