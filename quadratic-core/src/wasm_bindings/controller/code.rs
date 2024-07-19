use js_sys::Uint8Array;

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

    #[wasm_bindgen(js_name = "calculationGetCells")]
    #[allow(clippy::too_many_arguments)]
    pub fn js_calculation_get_cells(
        &mut self,
        transaction_id: String,
        x: i32,
        y: i32,
        w: i32,
        h: Option<i32>,
        sheet_name: Option<String>,
        line_number: Option<u32>,
    ) -> Result<String, JsValue> {
        match self.calculation_get_cells(
            transaction_id,
            x as i64,
            y as i64,
            w as i64,
            h.map(|h| h as i64),
            sheet_name,
            line_number,
        ) {
            Ok(get_cells) => match serde_json::to_string(&get_cells) {
                Ok(json) => Ok(json),
                Err(_) => {
                    dbgjs!("calculationGetCells: Failed to serialize calculation result");
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
        data: JsValue,
        std_out: Option<String>,
        std_err: Option<String>,
        extra: Option<String>,
    ) -> Result<(), JsValue> {
        let data = Uint8Array::new(&data);
        self.connection_complete(transaction_id, data.to_vec(), std_out, std_err, extra)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
