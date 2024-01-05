use std::str::FromStr;

use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, SheetId},
    CellValue, Pos, Rect,
};

#[derive(PartialEq, Debug)]
#[wasm_bindgen]
pub struct CodeCell {
    code_string: String,
    language: CodeCellLanguage,
    std_out: Option<String>,
    std_err: Option<String>,
    evaluation_result: Option<String>,
}

#[cfg(test)]
impl CodeCell {
    pub fn new(
        code_string: String,
        language: CodeCellLanguage,
        evaluation_result: Option<String>,
    ) -> Self {
        Self {
            code_string,
            language,
            evaluation_result,
            std_out: None,
            std_err: None,
        }
    }
}

#[wasm_bindgen]
impl CodeCell {
    #[wasm_bindgen(js_name = "getCodeString")]
    pub fn code_string(&self) -> String {
        self.code_string.clone()
    }
    #[wasm_bindgen(js_name = "getLanguage")]
    pub fn language(&self) -> CodeCellLanguage {
        self.language
    }
    #[wasm_bindgen(js_name = "getStdOut")]
    pub fn std_out(&self) -> Option<String> {
        self.std_out.clone()
    }
    #[wasm_bindgen(js_name = "getStdErr")]
    pub fn std_err(&self) -> Option<String> {
        self.std_err.clone()
    }
    #[wasm_bindgen(js_name = "getEvaluationResult")]
    pub fn evaluation_result(&self) -> Option<String> {
        self.evaluation_result.clone()
    }
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
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return String::from("");
        };
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

    /// Returns the CodeCell for a code (which is a combination of CellValue::Code and CodeRun).
    ///
    /// * CodeCell.evaluation_result is a stringified version of the output (used for AI models)
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: &Pos) -> Option<CodeCell> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return None;
        };
        let code_cell = sheet.get_cell_value(*pos)?;
        match code_cell {
            CellValue::Code(code_cell) => {
                if let Some(code_run) = sheet.code_run(*pos) {
                    Some(CodeCell {
                        code_string: code_cell.code,
                        language: code_cell.language,
                        std_err: code_run.std_err.clone(),
                        std_out: code_run.std_out.clone(),
                        evaluation_result: serde_json::to_string(&code_run.result).ok(),
                    })
                } else {
                    Some(CodeCell {
                        code_string: code_cell.code,
                        language: code_cell.language,
                        std_err: None,
                        std_out: None,
                        evaluation_result: None,
                    })
                }
            }
            _ => None,
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
        Ok(serde_wasm_bindgen::to_value(&self.set_code_cell(
            pos.to_sheet_pos(sheet_id),
            language,
            code_string,
            cursor,
        ))?)
    }
}
