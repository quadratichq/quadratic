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
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let pos = Pos::from((x, y));
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        self.set_cell_value((pos, sheet_id).into(), value.to_owned(), cursor, is_ai);

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
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let values: Vec<Vec<String>> = serde_wasm_bindgen::from_value(values)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse values: {e}")))?;
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.set_cell_values(
                SheetPos::new(sheet_id, x as i64, y as i64),
                values,
                cursor,
                is_ai,
            );

            Ok(())
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// Sets a cell to a RichText value with the given spans (as JSON).
    #[wasm_bindgen(js_name = "setCellRichText")]
    pub fn js_set_cell_rich_text(
        &mut self,
        sheet_id: String,
        x: i32,
        y: i32,
        spans_json: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = Pos::from((x, y));
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        let spans: Vec<crate::cellvalue::TextSpan> = serde_json::from_str(&spans_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse spans: {e}")))?;

        self.set_cell_rich_text((pos, sheet_id).into(), spans, cursor);

        Ok(())
    }

    /// changes the decimal places
    #[wasm_bindgen(js_name = "setCellNumericDecimals")]
    pub fn js_set_cell_numeric_decimals(
        &mut self,
        selection: String,
        delta: i32,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let selection = serde_json::from_str::<A1Selection>(&selection)
            .map_err(|_| JsValue::from_str("Invalid selection"))?;
        self.change_decimal_places(&selection, delta, cursor, is_ai)
    }

    /// gets an editable string for a cell
    ///
    /// returns a JsEditCell with text and optional code_cell info
    #[wasm_bindgen(js_name = "getEditCell")]
    pub fn js_get_cell_edit(&self, sheet_id: String, pos: String) -> Result<JsValue, JsValue> {
        use crate::grid::js_types::{JsEditCell, JsEditCellCodeCell};

        let pos: Pos = serde_json::from_str(&pos).map_err(|_| JsValue::UNDEFINED)?;
        let sheet = self
            .try_sheet_from_string_id(&sheet_id)
            .ok_or(JsValue::UNDEFINED)?;

        // Check if this is a CellValue::Code (single-cell code cell)
        if let Some(crate::CellValue::Code(code_cell)) = sheet.cell_value_ref(pos) {
            let result = JsEditCell {
                text: code_cell.output.to_edit(),
                code_cell: Some(JsEditCellCodeCell {
                    language: code_cell.code_run.language.clone(),
                    code: code_cell.code_run.code.clone(),
                }),
            };
            return serde_wasm_bindgen::to_value(&result).map_err(|_| JsValue::UNDEFINED);
        }

        // Otherwise, return the normal cell value for editing
        let val = sheet.get_cell_for_formula(pos);
        let result = JsEditCell {
            text: val.to_edit(),
            code_cell: None,
        };
        serde_wasm_bindgen::to_value(&result).map_err(|_| JsValue::UNDEFINED)
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
    pub fn js_delete_cell_values(
        &mut self,
        selection: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let selection = serde_json::from_str::<A1Selection>(&selection)
                .map_err(|e| format!("Unable to parse A1Selection: {e}"))?;

            self.delete_cells(&selection, cursor, is_ai);

            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "getAICells")]
    pub fn js_get_ai_cells(&self, a1: String, sheet_id: String, page: i32) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let selection = A1Selection::parse_a1(&a1, sheet_id, self.a1_context())
                .map_err(|e| format!("Unable to parse A1Selection: {e}"))?;

            let page = u32::try_from(page).map_err(|e| format!("Unable to parse page: {e}"))?;

            match &self.get_ai_cells(selection, page) {
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
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let selection = A1Selection::parse_a1(&a1, sheet_id, self.a1_context())
                .map_err(|e| format!("Unable to parse A1Selection: {e}"))?;

            match &self.get_ai_cell_formats(selection, page as u32) {
                Ok(ai_cell_formats) => Ok(Some(
                    serde_wasm_bindgen::to_value(ai_cell_formats).unwrap_or(JsValue::UNDEFINED),
                )),
                Err(e) => Err(format!("Unable to parse AICellFormats: {e}")),
            }
        })
    }

    #[wasm_bindgen(js_name = "hasCellData")]
    pub fn js_has_cell_data(&self, sheet_id: String, selection: String) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id).map_err(|_| "Unable to parse SheetId")?;
            let selection = A1Selection::parse_a1(&selection, sheet_id, self.a1_context())
                .map_err(|e| format!("Unable to parse A1Selection: {e}"))?;

            let has_data = if let Some(sheet) = self.try_sheet(sheet_id) {
                sheet.has_content_in_selection(selection, self.a1_context())
            } else {
                false
            };

            Ok(Some(if has_data {
                JsValue::TRUE
            } else {
                JsValue::FALSE
            }))
        })
    }
}
