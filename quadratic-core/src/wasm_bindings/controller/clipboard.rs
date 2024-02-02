use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::GridController,
    grid::{js_types::JsClipboard, SheetId},
    Pos, Rect,
};

#[wasm_bindgen]
impl GridController {
    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "copyToClipboard")]
    pub fn js_copy_to_clipboard(&self, sheet_id: String, rect: &Rect) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let (plain_text, html) = self.copy_to_clipboard(rect.to_sheet_rect(sheet_id));
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
        let (summary, plain_text, html) =
            self.cut_to_clipboard(rect.to_sheet_rect(sheet_id), cursor);
        let output = JsClipboard {
            plain_text,
            html,
            summary: Some(summary),
        };
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "pasteFromClipboard")]
    pub fn js_paste_from_clipboard(
        &mut self,
        sheet_id: String,
        pos: Pos,
        plain_text: Option<String>,
        html: Option<String>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output =
            self.paste_from_clipboard(pos.to_sheet_pos(sheet_id), plain_text, html, cursor);
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
