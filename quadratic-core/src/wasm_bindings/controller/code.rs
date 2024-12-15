use uuid::Uuid;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Called after a external calculation is complete.
    #[wasm_bindgen(js_name = "calculationComplete")]
    pub fn js_calculation_complete(&mut self, result: String) {
        if let Ok(result) = serde_json::from_str(&result) {
            let _ = self.calculation_complete(result);
        } else {
            dbgjs!("calculationComplete: Failed to parse calculation result");
        }
    }

    #[wasm_bindgen(js_name = "calculationGetCellsA1")]
    pub fn js_calculation_get_cells_a1(
        &mut self,
        transaction_id: String,
        a1: String,
        line_number: Option<u32>,
    ) -> Result<String, JsValue> {
        match self.calculation_get_cells_a1(transaction_id, a1, line_number) {
            Ok(response) => match serde_json::to_string(&response) {
                Ok(json) => Ok(json),
                Err(_) => {
                    dbgjs!("calculationGetCellsA1: Failed to serialize calculation result");
                    Err(JsValue::UNDEFINED)
                }
            },
            Err(_) => Err(JsValue::UNDEFINED),
        }
    }

    /// Returns the code cell (which is a combination of CellValue::Code and CodeRun).
    /// If the cell is part of a code run, it returns the code run that caused the output.
    ///
    /// * CodeCell.evaluation_result is a stringified version of the output (used for AI models)
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: String) -> Result<JsValue, JsValue> {
        let pos: Pos = serde_json::from_str(&pos).map_err(|_| JsValue::UNDEFINED)?;
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Ok(JsValue::null());
        };
        if let Some(edit_code) = sheet.edit_code_value(pos) {
            Ok(serde_wasm_bindgen::to_value(&edit_code)?)
        } else {
            Ok(JsValue::null())
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
        cursor: Option<String>,
    ) {
        if let Ok(pos) = serde_json::from_str::<Pos>(&pos) {
            let sheet_id = SheetId::from_str(&sheet_id).unwrap();
            if let Ok(language) = serde_wasm_bindgen::from_value(language) {
                self.set_code_cell(pos.to_sheet_pos(sheet_id), language, code_string, cursor);
            }
        }
    }

    /// Reruns all code cells in grid.
    #[wasm_bindgen(js_name = "rerunAllCodeCells")]
    pub fn js_rerun_code_cells(&mut self, cursor: Option<String>) {
        self.rerun_all_code_cells(cursor);
    }

    /// Reruns all code cells in a sheet.
    #[wasm_bindgen(js_name = "rerunSheetCodeCells")]
    pub fn js_rerun_sheet_code_cells(&mut self, sheet_id: String, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.rerun_sheet_code_cells(sheet_id, cursor);
        }
    }

    /// Reruns one code cell
    #[wasm_bindgen(js_name = "rerunCodeCell")]
    pub fn js_rerun_code_cell(&mut self, sheet_id: String, pos: String, cursor: Option<String>) {
        if let Ok(pos) = serde_json::from_str::<Pos>(&pos) {
            if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
                self.rerun_code_cell(pos.to_sheet_pos(sheet_id), cursor);
            }
        }
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

    #[wasm_bindgen(js_name = "receiveAIResearcherResult")]
    pub fn js_receive_ai_researcher_result(
        &mut self,
        transaction_id: String,
        sheet_pos: String,
        cell_value: Option<String>,
        error: Option<String>,
        researcher_response_stringified: Option<String>,
    ) -> Result<(), JsValue> {
        let transaction_id = match Uuid::parse_str(&transaction_id) {
            Ok(transaction_id) => transaction_id,
            Err(e) => return Err(JsValue::from_str(&format!("Invalid transaction id: {}", e))),
        };

        let sheet_pos: SheetPos =
            serde_json::from_str(&sheet_pos).map_err(|_| JsValue::UNDEFINED)?;
        self.receive_ai_researcher_result(
            transaction_id,
            sheet_pos,
            cell_value,
            error,
            researcher_response_stringified,
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
