use std::str::FromStr;

use crate::SheetPos;
use crate::a1::A1Selection;
use crate::wasm_bindings::capture_core_error;
use crate::{Pos, controller::GridController, grid::SheetId};
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[wasm_bindgen]
impl GridController {
    /// Sets a cell value given as a [`CellValue`].
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellValue")]
    pub fn js_set_cell_value(
        &mut self,
        sheet_id: String,
        x: i32,
        y: i32,
        value: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = Pos::from((x, y));
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        self.set_cell_value((pos, sheet_id).into(), value.to_owned(), cursor);

        Ok(())
    }

    /// Sets a 2d array of cell values with x and y being the top left corner of the 2d array.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setCellValues")]
    pub fn js_set_cell_values(
        &mut self,
        sheet_id: String,
        x: i32,
        y: i32,
        values: JsValue,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let values: Vec<Vec<String>> = serde_wasm_bindgen::from_value(values)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse values: {e}")))?;
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.set_cell_values(SheetPos::new(sheet_id, x as i64, y as i64), values, cursor);

            Ok(())
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// changes the decimal places
    #[wasm_bindgen(js_name = "setCellNumericDecimals")]
    pub fn js_set_cell_numeric_decimals(
        &mut self,
        selection: String,
        delta: i32,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| JsValue::from_str("Invalid selection"))?;
        self.change_decimal_places(&selection, delta, cursor)
    }

    /// gets an editable string for a cell
    ///
    /// returns a string
    #[wasm_bindgen(js_name = "getEditCell")]
    pub fn js_get_cell_edit(&self, sheet_id: String, pos: String) -> Result<String, JsValue> {
        let pos = serde_json::from_str(&pos).map_err(|_| JsValue::UNDEFINED)?;
        let sheet = self
            .try_sheet_from_string_id(&sheet_id)
            .ok_or(JsValue::UNDEFINED)?;
        let val = sheet.get_cell_for_formula(pos);

        Ok(val.to_edit())
    }

    /// gets the display value for a cell
    #[wasm_bindgen(js_name = "getDisplayValue")]
    pub fn js_get_cell_display(&self, sheet_id: String, pos: String) -> String {
        let Ok(pos) = serde_json::from_str(&pos) else {
            return String::default();
        };
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return String::default();
        };
        sheet.rendered_value(pos).unwrap_or(String::default())
    }

    /// gets the value and type for a cell
    /// returns a stringified JsCellValue
    #[wasm_bindgen(js_name = "getCellValue")]
    pub fn js_get_cell_value(&self, sheet_id: String, pos: String) -> Result<JsValue, JsValue> {
        let pos = serde_json::from_str(&pos).unwrap_or_default();
        let sheet = self
            .try_sheet_from_string_id(&sheet_id)
            .ok_or(JsValue::UNDEFINED)?;
        let cell_value = sheet.js_cell_value(pos);
        serde_wasm_bindgen::to_value(&cell_value).map_err(|_| JsValue::UNDEFINED)
    }

    /// Deletes a region of cells.
    #[wasm_bindgen(js_name = "deleteCellValues")]
    pub fn js_delete_cell_values(&mut self, selection: String, cursor: Option<String>) -> JsValue {
        capture_core_error(|| {
            let Ok(selection) = serde_json::from_str::<A1Selection>(&selection) else {
                return Err("Unable to parse A1Selection".to_string());
            };

            self.delete_cells(&selection, cursor);

            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "getAICells")]
    pub fn js_get_ai_cells(&self, a1: String, sheet_id: String, page: i32) -> JsValue {
        capture_core_error(|| {
            let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
                return Err("Unable to parse SheetId".to_string());
            };
            let Ok(selection) = A1Selection::parse_a1(&a1, sheet_id, self.a1_context()) else {
                return Err("Unable to parse A1Selection".to_string());
            };

            match &self.get_ai_cells(selection, page as u32) {
                Ok(ai_cells) => Ok(Some(
                    serde_wasm_bindgen::to_value(ai_cells).unwrap_or(JsValue::UNDEFINED),
                )),
                Err(e) => Err(format!("Unable to parse AICells: {e}")),
            }
        })
    }

    #[wasm_bindgen(js_name = "getAICellFormats")]
    pub fn js_get_ai_cell_formats(&self, sheet_id: String, a1: String, page: i32) -> JsValue {
        capture_core_error(|| {
            let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
                return Err("Unable to parse SheetId".to_string());
            };
            let Ok(selection) = A1Selection::parse_a1(&a1, sheet_id, self.a1_context()) else {
                return Err("Unable to parse A1Selection".to_string());
            };

            match &self.get_ai_cell_formats(selection, page as u32) {
                Ok(ai_cell_formats) => Ok(Some(
                    serde_wasm_bindgen::to_value(ai_cell_formats).unwrap_or(JsValue::UNDEFINED),
                )),
                Err(e) => Err(format!("Unable to parse AICellFormats: {e}")),
            }
        })
    }
}
