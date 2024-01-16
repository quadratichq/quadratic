use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "calculationComplete")]
    pub fn js_calculation_complete(&mut self, result: JsCodeResult) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(
            &self.calculation_complete(result),
        )?)
    }

    #[wasm_bindgen(js_name = "calculationGetCells")]
    pub fn js_calculation_get_cells(
        &mut self,
        get_cells: JsComputeGetCells,
    ) -> Result<JsValue, JsValue> {
        match self.calculation_get_cells(get_cells) {
            Ok(get_cells) => Ok(serde_wasm_bindgen::to_value(&get_cells)?),
            Err(e) => Err(serde_wasm_bindgen::to_value(&e)?),
        }
    }

    /// Returns the code cell(which is a combination of CellValue::Code and CodeRun).
    /// If the cell is part of a code run, it returns the code run that caused the output.
    ///
    /// * CodeCell.evaluation_result is a stringified version of the output (used for AI models)
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: &Pos) -> Result<JsValue, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Ok(JsValue::null());
        };
        let Some(code_cell) = sheet.cell_value(*pos) else {
            return Ok(JsValue::null());
        };
        match code_cell {
            CellValue::Code(code_cell) => {
                let code_cell = if let Some(code_run) = sheet.code_run(*pos) {
                    let evaluation_result =
                        serde_json::to_string(&code_run.result).unwrap_or("".to_string());
                    JsCodeCell {
                        code_string: code_cell.code,
                        language: code_cell.language,
                        std_err: code_run.std_err.clone(),
                        std_out: code_run.std_out.clone(),
                        evaluation_result: Some(evaluation_result),
                    }
                } else {
                    JsCodeCell {
                        code_string: code_cell.code,
                        language: code_cell.language,
                        std_err: None,
                        std_out: None,
                        evaluation_result: None,
                    }
                };
                Ok(serde_wasm_bindgen::to_value(&code_cell)?)
            }
            _ => Ok(JsValue::null()),
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
        language: JsValue,
        code_string: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let language = serde_wasm_bindgen::from_value(language)?;
        Ok(serde_wasm_bindgen::to_value(&self.set_code_cell(
            pos.to_sheet_pos(sheet_id),
            language,
            code_string,
            cursor,
        ))?)
    }
}
