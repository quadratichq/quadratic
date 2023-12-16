use std::str::FromStr;

use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, SheetId},
    Pos, Rect,
};
use serde::{Deserialize, Serialize};
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct JsCodeCell {
    pub code_string: String,
    pub language: CodeCellLanguage,
    pub std_out: Option<String>,
    pub std_err: Option<String>,
}

#[wasm_bindgen]
impl GridController {
    /// Sets a cell value given as a [`CellValue`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn js_set_cell_value(
        &mut self,
        sheet_id: String,
        pos: &Pos,
        value: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            Ok(serde_wasm_bindgen::to_value(&self.set_cell_value(
                pos.to_sheet_pos(sheet_id),
                value,
                cursor,
            ))?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// changes the decimal places
    #[wasm_bindgen(js_name = "setCellNumericDecimals")]
    pub fn js_set_cell_numeric_decimals(
        &mut self,
        sheet_id: String,
        source: Pos,
        rect: Rect,
        delta: isize,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            Ok(serde_wasm_bindgen::to_value(&self.change_decimal_places(
                source.to_sheet_pos(sheet_id),
                rect.to_sheet_rect(sheet_id),
                delta,
                cursor,
            ))?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// gets an editable string for a cell
    ///
    /// returns a string
    #[wasm_bindgen(js_name = "getEditCell")]
    pub fn js_get_cell_edit(&self, sheet_id: String, pos: Pos) -> String {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let sheet = self.grid().sheet_from_id(sheet_id);
        if let Some(value) = sheet.get_cell_value_only(pos) {
            value.to_edit()
        } else {
            String::from("")
        }
    }

    /// Deletes a region of cells.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "deleteCellValues")]
    pub fn js_delete_cell_values(
        &mut self,
        sheet_id: String,
        rect: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.delete_cells_rect(rect.to_sheet_rect(sheet_id), cursor),
        )?)
    }

    /// Gets the code_string of a code cell
    ///
    /// returns a stringified [`JsCodeCell`] or undefined
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: &Pos) -> Result<String, JsValue> {
        let sheet = self.grid().sheet_from_string(sheet_id);
        if let Some(code_cell) = sheet.get_code_cell(*pos) {
            let mut js_code_cell = JsCodeCell {
                code_string: code_cell.code_string.clone(),
                language: code_cell.language,
                std_err: None,
                std_out: None,
            };
            if let Some(run) = sheet.get_code_cell_run(*pos) {
                js_code_cell.std_out = run.std_out.clone();
                js_code_cell.std_err = run.std_err.clone();
            }
            serde_json::to_string(&js_code_cell).map_err(|e| JsValue::UNDEFINED)
        } else {
            Err(JsValue::UNDEFINED)
        }
    }

    /// Sets the code on a cell
    ///
    /// Returns [`TransactionSummary`]
    #[wasm_bindgen(js_name = "setCellCode")]
    pub fn js_set_cell_code(
        &mut self,
        sheet_id: String,
        pos: Pos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.set_cell_code(
            pos.to_sheet_pos(sheet_id),
            language,
            code_string,
            cursor,
        ))?)
    }
}
