use std::str::FromStr;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::a1::A1Selection;
use crate::controller::operations::clipboard::ClipboardOperation;
use crate::grid::js_types::JsClipboard;
use crate::wasm_bindings::capture_core_error;
use crate::{
    SheetPos, SheetRect,
    controller::{GridController, operations::clipboard::PasteSpecial},
    grid::SheetId,
};

#[wasm_bindgen]
impl GridController {
    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "copyToClipboard")]
    pub fn js_copy_to_clipboard(&self, selection: String) -> Result<Vec<u8>, JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let sheet = self.try_sheet(selection.sheet_id).ok_or("No Sheet found")?;
        let clipboard = sheet.copy_to_clipboard(
            &selection,
            self.a1_context(),
            ClipboardOperation::Copy,
            true,
        );
        let js_clipboard: JsClipboard = clipboard.into();
        Ok(serde_json::to_vec(&js_clipboard).map_err(|e| e.to_string())?)
    }

    /// Returns the clipboard [`JsClipboard`]
    #[wasm_bindgen(js_name = "cutToClipboard")]
    pub fn js_cut_to_clipboard(
        &mut self,
        selection: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<Vec<u8>, JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let js_clipboard = self.cut_to_clipboard(&selection, true, cursor, is_ai)?;
        Ok(serde_json::to_vec(&js_clipboard).map_err(|e| e.to_string())?)
    }

    #[wasm_bindgen(js_name = "pasteFromClipboard")]
    pub fn js_paste_from_clipboard(
        &mut self,
        selection: String,
        js_clipboard: Vec<u8>,
        special: &str,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let special = PasteSpecial::from(special);
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| "Unable to parse A1Selection")?;
        let js_clipboard =
            serde_json::from_slice(&js_clipboard).map_err(|_| "Unable to parse js_clipboard")?;
        self.paste_from_clipboard(&selection, js_clipboard, special, cursor, is_ai);
        Ok(())
    }

    #[wasm_bindgen(js_name = "moveColsRows")]
    pub fn js_move_cols_rows(
        &mut self,
        source: String,
        dest: String,
        columns: bool,
        rows: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let source = SheetRect::from_str(&source)?;
        let dest = SheetPos::from_str(&dest)?;
        self.move_cols_rows(source, dest, columns, rows, cursor, is_ai);
        Ok(())
    }

    /// Move multiple cell regions in a single transaction
    /// moves_json is a JSON array of objects with source and dest properties
    #[wasm_bindgen(js_name = "moveCellsBatch")]
    pub fn js_move_cells_batch(
        &mut self,
        moves_json: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let moves: Vec<(SheetRect, SheetPos)> =
            serde_json::from_str(&moves_json).map_err(|e| e.to_string())?;
        self.move_cells_batch(moves, cursor, is_ai);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = "moveCodeCellVertically")]
    pub fn js_move_code_cell_vertically(
        &mut self,
        sheet_id: String,
        x: i64,
        y: i64,
        sheet_end: bool,
        reverse: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            match serde_wasm_bindgen::to_value(
                &self.move_code_cell_vertically(sheet_id, x, y, sheet_end, reverse, cursor, is_ai),
            ) {
                Ok(value) => Ok(Some(value)),
                Err(e) => Err(e.to_string()),
            }
        })
    }

    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = "moveCodeCellHorizontally")]
    pub fn js_move_code_cell_horizontally(
        &mut self,
        sheet_id: String,
        x: i64,
        y: i64,
        sheet_end: bool,
        reverse: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            match serde_wasm_bindgen::to_value(
                &self
                    .move_code_cell_horizontally(sheet_id, x, y, sheet_end, reverse, cursor, is_ai),
            ) {
                Ok(value) => Ok(Some(value)),
                Err(e) => Err(e.to_string()),
            }
        })
    }
}
