use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use super::js_types::{JsCellValuePosAIContext, JsCodeCell};
use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::grid::js_types::JsTablesContext;

#[wasm_bindgen]
impl GridController {
    /// gets values, types with position for all cells in selection
    /// returns an array of JsCellValuePosAIContext for all sheet_rects
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
                    sheet.get_ai_context_rects_in_selection(selection, max_rects);
                all_ai_context_rects.push(ai_context_rects);
            }
        }
        serde_wasm_bindgen::to_value(&all_ai_context_rects).map_err(|_| JsValue::UNDEFINED)
    }

    /// gets JsCodeCell for all cells in sheet_rects that have errors
    /// returns an array of JsCodeCell for all sheet_rects
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

    /// gets all tables (data, code, charts) in the grid, single cell (data, code) tables are not included
    /// returns an array of JsTablesContext for all tables in the grid
    #[wasm_bindgen(js_name = "getAITablesContext")]
    pub fn js_get_ai_tables_context(&self) -> Result<JsValue, JsValue> {
        let mut tables: Vec<JsTablesContext> = Vec::new();
        for sheet in self.grid().sheets() {
            if let Some(tables_in_sheet) = sheet.get_ai_tables_context() {
                tables.push(tables_in_sheet);
            }
        }
        serde_wasm_bindgen::to_value(&tables).map_err(|_| JsValue::UNDEFINED)
    }
}
