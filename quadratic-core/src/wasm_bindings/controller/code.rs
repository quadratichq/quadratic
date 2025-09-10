use crate::a1::A1Selection;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Called after a external calculation is complete.
    #[wasm_bindgen(js_name = "calculationComplete")]
    pub fn js_calculation_complete(&mut self, result: Vec<u8>) {
        match serde_json::from_slice(&result) {
            Ok(result) => {
                let _ = self.calculation_complete(result);
            }
            Err(e) => {
                dbgjs!(format!(
                    "calculationComplete: Failed to parse calculation result: {:?}",
                    e
                ));
            }
        }
    }

    #[wasm_bindgen(js_name = "calculationGetCellsA1")]
    pub fn js_calculation_get_cells_a1(
        &mut self,
        transaction_id: String,
        a1: String,
    ) -> Result<Vec<u8>, String> {
        let response = self.calculation_get_cells_a1(transaction_id, a1);
        match serde_json::to_vec(&response) {
            Ok(vec) => Ok(vec),
            Err(e) => {
                dbgjs!(format!(
                    "calculationGetCellsA1: Failed to serialize get cells a1 response: {:?}",
                    e
                ));
                Err(format!("Failed to serialize get cells a1 response: {e:?}"))
            }
        }
    }

    /// Returns the code cell if the pos is part of a code run.
    ///
    /// * CodeCell.evaluation_result is a stringified version of the output (used for AI models)
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: String) -> JsValue {
        let Ok(pos) = serde_json::from_str::<Pos>(&pos) else {
            return JsValue::UNDEFINED;
        };
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return JsValue::UNDEFINED;
        };
        if let Some(edit_code) = sheet.edit_code_value(pos, self.a1_context()) {
            serde_wasm_bindgen::to_value(&edit_code).unwrap_or(JsValue::UNDEFINED)
        } else {
            JsValue::UNDEFINED
        }
    }

    /// Sets the code on a cell
    #[wasm_bindgen(js_name = "setCellCode")]
    pub fn js_set_cell_code(
        &mut self,
        sheet_id: String,
        pos: String,
        language: JsValue,
        code_string: String,
        code_cell_name: Option<String>,
        cursor: Option<String>,
    ) -> Option<String> {
        if let Ok(pos) = serde_json::from_str::<Pos>(&pos)
            && let Ok(sheet_id) = SheetId::from_str(&sheet_id)
            && let Ok(language) = serde_wasm_bindgen::from_value(language)
        {
            return Some(self.set_code_cell(
                pos.to_sheet_pos(sheet_id),
                language,
                code_string,
                code_cell_name,
                cursor,
            ));
        }
        None
    }

    /// Reruns all code cells in grid.
    #[wasm_bindgen(js_name = "rerunAllCodeCells")]
    pub fn js_rerun_code_cells(&mut self, cursor: Option<String>) -> JsValue {
        capture_core_error(|| {
            let transaction_id = self.rerun_all_code_cells(cursor);
            Ok(Some(
                serde_wasm_bindgen::to_value(&transaction_id).unwrap_or(JsValue::UNDEFINED),
            ))
        })
    }

    /// Reruns all code cells in a sheet.
    #[wasm_bindgen(js_name = "rerunSheetCodeCells")]
    pub fn js_rerun_sheet_code_cells(
        &mut self,
        sheet_id: String,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            let transaction_id = self.rerun_sheet_code_cells(sheet_id, cursor);
            Ok(Some(
                serde_wasm_bindgen::to_value(&transaction_id).unwrap_or(JsValue::UNDEFINED),
            ))
        })
    }

    /// Reruns one code cell
    #[wasm_bindgen(js_name = "rerunCodeCell")]
    pub fn js_rerun_code_cell(
        &mut self,
        sheet_id: String,
        selection: String,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            let selection = A1Selection::parse_a1(&selection, sheet_id, self.a1_context())
                .map_err(|e| format!("Invalid selection: {e}"))?;
            let transaction_id = self.rerun_code_cell(selection, cursor);
            Ok(Some(
                serde_wasm_bindgen::to_value(&transaction_id).unwrap_or(JsValue::UNDEFINED),
            ))
        })
    }

    #[wasm_bindgen(js_name = "connectionComplete")]
    pub fn js_connection_complete(
        &mut self,
        transaction_id: String,
        data: Vec<u8>,
        std_out: Option<String>,
        std_err: Option<String>,
        extra: Option<String>,
    ) -> Result<(), JsValue> {
        self.connection_complete(transaction_id, data, std_out, std_err, extra)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
