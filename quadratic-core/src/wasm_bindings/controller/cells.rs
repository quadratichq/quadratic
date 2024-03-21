use std::str::FromStr;

use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Pos, Rect};

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
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return String::from("");
        };
        if let Some(value) = sheet.cell_value(pos) {
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
}
