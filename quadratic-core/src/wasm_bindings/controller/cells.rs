use std::str::FromStr;

use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use super::js_types::{JsCellValuePosAIContext, JsCodeCell};
use crate::A1Selection;
use crate::{controller::GridController, grid::SheetId, Pos};

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
    ) -> Result<JsValue, JsValue> {
        let pos = Pos {
            x: x as i64,
            y: y as i64,
        };
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
    ) -> Result<JsValue, JsValue> {
        let values: Vec<Vec<String>> = serde_wasm_bindgen::from_value(values)
            .map_err(|_| JsValue::from_str("Invalid values"))?;
        let values: Vec<Vec<&str>> = values
            .iter()
            .map(|row| row.iter().map(|s| s.as_str()).collect())
            .collect();
        let pos = Pos {
            x: x as i64,
            y: y as i64,
        };
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            Ok(serde_wasm_bindgen::to_value(&self.set_cell_values(
                pos.to_sheet_pos(sheet_id),
                values,
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
            .try_sheet_from_string_id(sheet_id)
            .ok_or(JsValue::UNDEFINED)?;
        if let Some(value) = sheet.cell_value(pos) {
            Ok(value.to_edit())
        } else {
            Ok(String::from(""))
        }
    }

    /// gets the display value for a cell
    #[wasm_bindgen(js_name = "getDisplayValue")]
    pub fn js_get_cell_display(&self, sheet_id: String, pos: String) -> String {
        let Ok(pos) = serde_json::from_str(&pos) else {
            return String::default();
        };
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
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
            .try_sheet_from_string_id(sheet_id)
            .ok_or(JsValue::UNDEFINED)?;
        let cell_value = sheet.js_cell_value(pos);
        serde_wasm_bindgen::to_value(&cell_value).map_err(|_| JsValue::UNDEFINED)
    }

    /// Deletes a region of cells.
    #[wasm_bindgen(js_name = "deleteCellValues")]
    pub fn js_delete_cell_values(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| JsValue::from_str("Unable to parse A1Selection"))?;
        self.delete_cells(&selection, cursor);
        Ok(())
    }

    /// gets values, types with position for all cells in selection
    /// returns a stringified array of JsCellValuePosAIContext for all sheet_rects
    #[wasm_bindgen(js_name = "getAIContextRectsInSelections")]
    pub fn js_ai_context_rects_in_selections(
        &self,
        selections: Vec<String>,
        max_rects: Option<usize>,
    ) -> Result<JsValue, JsValue> {
        let selections = selections
            .iter()
            .map(|selection| serde_json::from_str::<A1Selection>(selection))
            .collect::<Result<Vec<A1Selection>, _>>()
            .map_err(|_| JsValue::from_str("Unable to parse A1Selection"))?;
        let mut all_ai_context_rects: Vec<Vec<JsCellValuePosAIContext>> = Vec::new();
        for selection in selections {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                let ai_context_rects =
                    sheet.get_ai_context_rects_in_selection(selection, max_rects, Some(3));
                all_ai_context_rects.push(ai_context_rects);
            }
        }
        serde_wasm_bindgen::to_value(&all_ai_context_rects).map_err(|_| JsValue::UNDEFINED)
    }

    /// gets JsCodeCell for all cells in sheet_rects that have errors
    /// returns a stringified array of JsCodeCell for all sheet_rects
    #[wasm_bindgen(js_name = "getErroredCodeCellsInSelections")]
    pub fn js_errored_code_cells_in_selections(
        &self,
        selections: Vec<String>,
    ) -> Result<JsValue, JsValue> {
        let selections = selections
            .iter()
            .map(|selection| serde_json::from_str::<A1Selection>(selection))
            .collect::<Result<Vec<A1Selection>, _>>()
            .map_err(|_| JsValue::from_str("Unable to parse A1Selection"))?;
        let mut all_errored_code_cells: Vec<Vec<JsCodeCell>> = Vec::new();
        for selection in selections {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                let errored_code_cells = sheet.get_errored_code_cells_in_selection(selection);
                all_errored_code_cells.push(errored_code_cells);
            }
        }
        serde_wasm_bindgen::to_value(&all_errored_code_cells).map_err(|_| JsValue::UNDEFINED)
    }
}
