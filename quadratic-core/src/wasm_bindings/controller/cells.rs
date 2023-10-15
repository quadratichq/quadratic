use std::str::FromStr;

use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::GridController,
    grid::{CodeCellLanguage, SheetId},
    Pos, Rect,
};

#[derive(PartialEq, Debug)]
#[wasm_bindgen]
pub struct CodeCell {
    code_string: String,
    language: CodeCellLanguage,
    std_out: Option<String>,
    std_err: Option<String>,
}

#[cfg(test)]
impl CodeCell {
    pub fn new(code_string: String, language: CodeCellLanguage) -> Self {
        Self {
            code_string,
            language,
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
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_cell_value(sheet_id, *pos, value, cursor),
        )?)
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
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.change_decimal_places(
            sheet_id, source, rect, delta, cursor,
        ))?)
    }

    /// gets an editable string for a cell
    ///
    /// returns a string
    #[wasm_bindgen(js_name = "getEditCell")]
    pub fn js_get_cell_edit(&self, sheet_id: String, pos: Pos) -> String {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let sheet = self.grid().sheet_from_id(sheet_id);
        if let Some(value) = sheet.get_cell_value(pos) {
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
        region: &Rect,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.delete_cell_values(sheet_id, *region, cursor),
        )?)
    }

    /// Gets the code_string of a code cell
    #[wasm_bindgen(js_name = "getCodeCell")]
    pub fn js_get_code_string(&self, sheet_id: String, pos: &Pos) -> Option<CodeCell> {
        let sheet = self.grid().sheet_from_string(sheet_id);
        if let Some(code_cell) = sheet.get_code_cell(*pos) {
            let (std_err, std_out) = if let Some(code_cell) = code_cell.output.as_ref() {
                (code_cell.std_err.clone(), code_cell.std_out.clone())
            } else {
                (None, None)
            };
            Some(CodeCell {
                code_string: code_cell.code_string.clone(),
                language: code_cell.language,
                std_err,
                std_out,
            })
        } else {
            None
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
        Ok(serde_wasm_bindgen::to_value(&self.set_cell_code(
            sheet_id,
            pos,
            language,
            code_string,
            cursor,
        ))?)
    }
}
