use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::GridController,
    grid::{js_types::JsClipboard, SheetId},
    Rect,
};

#[wasm_bindgen]
impl GridController {
    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "copyToClipboard")]
    pub fn js_copy_to_clipboard(&self, sheet_id: String, rect: &Rect) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let (plain_text, html) = self.copy_to_clipboard(sheet_id, *rect);
        let output = JsClipboard {
            plain_text,
            html,
            summary: None,
        };
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "cutToClipboard")]
    pub fn js_cut_to_clipboard(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let (summary, plain_text, html) = self.cut_to_clipboard(sheet_id, *rect, cursor);
        let output = JsClipboard {
            plain_text,
            html,
            summary: Some(summary),
        };
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
