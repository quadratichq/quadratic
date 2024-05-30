use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::{user_actions::clipboard::PasteSpecial, GridController},
    grid::{js_types::JsClipboard, SheetId},
    selection::Selection,
    Pos,
};

#[wasm_bindgen]
impl GridController {
    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "copyToClipboard")]
    pub fn js_copy_to_clipboard(&self, selection: String) -> Result<JsValue, JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let sheet = self.try_sheet(selection.sheet_id).ok_or("No Sheet found")?;
        let sheet_rect = sheet
            .clipboard_selection(&selection)
            .ok_or("No SheetRect found")?;
        let (plain_text, html) = self.copy_to_clipboard(sheet_rect);
        let output = JsClipboard { plain_text, html };
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "cutToClipboard")]
    pub fn js_cut_to_clipboard(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let sheet = self.try_sheet(selection.sheet_id).ok_or("No Sheet found")?;
        let sheet_rect = sheet
            .clipboard_selection(&selection)
            .ok_or("No SheetRect found")?;
        let (plain_text, html) = self.cut_to_clipboard(sheet_rect, cursor);
        let output = JsClipboard { plain_text, html };
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "pasteFromClipboard")]
    pub fn js_paste_from_clipboard(
        &mut self,
        sheet_id: String,
        dest_pos: Pos,
        plain_text: Option<String>,
        html: Option<String>,
        special: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let special = if &special == "None" {
            PasteSpecial::None
        } else if &special == "Values" {
            PasteSpecial::Values
        } else if &special == "Formats" {
            PasteSpecial::Formats
        } else {
            return Err(JsValue::from_str("Invalid special"));
        };
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Ok(());
        };
        self.paste_from_clipboard(
            dest_pos.to_sheet_pos(sheet_id),
            plain_text,
            html,
            special,
            cursor,
        );
        Ok(())
    }

    #[wasm_bindgen(js_name = "moveCells")]
    pub fn js_move_cells(
        &mut self,
        source: JsValue,
        dest: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let source = serde_wasm_bindgen::from_value(source).map_err(|e| e.to_string())?;
        let dest = serde_wasm_bindgen::from_value(dest).map_err(|e| e.to_string())?;
        self.move_cells(source, dest, cursor);
        Ok(())
    }
}
