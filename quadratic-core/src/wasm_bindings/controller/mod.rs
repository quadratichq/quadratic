use super::*;
use crate::{controller::transactions::TransactionSummary, grid::js_types::*};
use std::str::FromStr;

pub mod auto_complete;
pub mod bounds;
pub mod borders;
pub mod clipboard;
pub mod formatting;
pub mod import;
pub mod offsets;
pub mod render;
pub mod sheets;

#[wasm_bindgen]
impl GridController {
    /// Imports a [`GridController`] from a JSON string.
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(file: &str) -> Result<GridController, JsValue> {
        Ok(GridController::from_grid(file::import(file)?))
    }

    /// Exports a [`GridController`] to a file. Returns a `String`.
    #[wasm_bindgen(js_name = "exportToFile")]
    pub fn js_export_to_file(&self) -> Result<String, JsValue> {
        Ok(file::export(&self.grid())?)
    }

    /// Exports a [`string`]
    #[wasm_bindgen(js_name = "getVersion")]
    pub fn js_file_version(&self) -> String {
        file::version()
    }

    /// Constructs a new empty grid.
    #[wasm_bindgen(constructor)]
    pub fn js_new() -> Self {
        Self::new()
    }

    /// Returns whether there is a transaction to undo.
    #[wasm_bindgen(js_name = "hasUndo")]
    pub fn js_has_undo(&self) -> bool {
        self.has_undo()
    }
    /// Returns whether there is a transaction to redo.
    #[wasm_bindgen(js_name = "hasRedo")]
    pub fn js_has_redo(&self) -> bool {
        self.has_redo()
    }

    /// Undoes one transaction. Returns a [`TransactionSummary`], or `null` if
    /// there was nothing to undo.
    #[wasm_bindgen(js_name = "undo")]
    pub fn js_undo(&mut self, cursor: Option<String>) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.undo(cursor))?)
    }
    /// Redoes one transaction. Returns a [`TransactionSummary`], or `null` if
    /// there was nothing to redo.
    #[wasm_bindgen(js_name = "redo")]
    pub fn js_redo(&mut self, cursor: Option<String>) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.redo(cursor))?)
    }

    /// Populates a portion of a sheet with random float values.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "populateWithRandomFloats")]
    pub fn js_populate_with_random_floats(
        &mut self,
        sheet_id: String,
        region: &Rect,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        self.populate_with_random_floats(sheet_id, region);
        Ok(serde_wasm_bindgen::to_value(&TransactionSummary {
            cell_regions_modified: vec![(sheet_id, *region)],
            fill_sheets_modified: vec![],
            border_sheets_modified: vec![],
            code_cells_modified: vec![],
            sheet_list_modified: false,
            cursor: None,
        })?)
    }

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

    /// Returns a code cell as a [`CodeCellValue`].
    #[wasm_bindgen(js_name = "getCodeCellValue")]
    pub fn get_code_cell_value(&mut self, sheet_id: String, pos: &Pos) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        match self.sheet(sheet_id).get_code_cell(*pos) {
            Some(code_cell) => Ok(serde_wasm_bindgen::to_value(&code_cell)?),
            None => Ok(JsValue::UNDEFINED),
        }
    }
}
