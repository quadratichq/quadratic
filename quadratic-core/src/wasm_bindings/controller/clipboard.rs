use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::{operations::clipboard::PasteSpecial, GridController},
    grid::js_types::JsClipboard,
    selection::OldSelection,
    SheetPos, SheetRect,
};

#[wasm_bindgen]
impl GridController {
    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "copyToClipboard")]
    pub fn js_copy_to_clipboard(&self, selection: String) -> Result<JsValue, JsValue> {
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let sheet = self.try_sheet(selection.sheet_id).ok_or("No Sheet found")?;
        let (plain_text, html) = sheet.copy_to_clipboard(&selection)?;
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let (plain_text, html) = self.cut_to_clipboard(&selection, cursor)?;
        let output = JsClipboard { plain_text, html };
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "pasteFromClipboard")]
    pub fn js_paste_from_clipboard(
        &mut self,
        selection: String,
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
        let selection = OldSelection::from_str(&selection).map_err(|_| "Invalid selection")?;
        self.paste_from_clipboard(selection, plain_text, html, special, cursor);
        Ok(())
    }

    #[wasm_bindgen(js_name = "moveCells")]
    pub fn js_move_cells(
        &mut self,
        source: String,
        dest: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let source = SheetRect::from_str(&source)?;
        let dest = SheetPos::from_str(&dest)?;
        self.move_cells(source, dest, cursor);
        Ok(())
    }
}
