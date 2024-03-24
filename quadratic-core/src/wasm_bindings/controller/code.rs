use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "calculationComplete")]
    pub fn js_calculation_complete(&mut self, result: String) {
        if let Ok(result) = serde_json::from_str(&result) {
            let _ = self.calculation_complete(result);
        } else {
            dbgjs!("Failed to parse calculation result");
        }
    }

    #[wasm_bindgen(js_name = "calculationGetCells")]
    pub fn js_calculation_get_cells(&mut self, get_cells: String) -> Result<JsValue, JsValue> {
        let Ok(get_cells) = serde_json::from_str(&get_cells) else {
            return Err(JsValue::UNDEFINED);
        };
        match self.calculation_get_cells(get_cells) {
            Ok(get_cells) => Ok(serde_wasm_bindgen::to_value(&get_cells)?),
            Err(e) => Err(serde_wasm_bindgen::to_value(&e)?),
        }
    }

    /// Returns the code cell (which is a combination of CellValue::Code and CodeRun).
    /// If the cell is part of a code run, it returns the code run that caused the output.
    ///
    /// * CodeCell.evaluation_result is a stringified version of the output (used for AI models)
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: &Pos) -> Result<JsValue, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Ok(JsValue::null());
        };
        if let Some(edit_code) = sheet.edit_code_value(*pos) {
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
        pos: Pos,
        language: JsValue,
        code_string: String,
        cursor: Option<String>,
    ) {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        if let Ok(language) = serde_wasm_bindgen::from_value(language) {
            self.set_code_cell(pos.to_sheet_pos(sheet_id), language, code_string, cursor);
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
    pub fn js_rerun_code_cell(&mut self, sheet_id: String, pos: Pos, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.rerun_code_cell(pos.to_sheet_pos(sheet_id), cursor);
        }
    }
}
