#[cfg(feature = "js")]
use wasm_bindgen::{JsValue, prelude::*};

use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::grid::js_types::JsTablesContext;
use std::collections::HashMap;

#[wasm_bindgen]
impl GridController {
    /// get context for ai in selection
    /// returns an array of JsSelectionContext, one for each selection
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = "getAISelectionContexts")]
    pub fn js_ai_selection_contexts(
        &self,
        selections: Vec<String>,
        max_rects: Option<usize>,
        max_rows: Option<usize>,
        include_errored_code_cells: bool,
        include_tables_summary: bool,
        include_charts_summary: bool,
        include_data_rects_summary: bool,
    ) -> Result<JsValue, JsValue> {
        let selections = selections
            .iter()
            .map(|selection| serde_json::from_str::<A1Selection>(selection))
            .collect::<Result<Vec<A1Selection>, _>>()
            .map_err(|_| JsValue::from_str("Unable to parse A1Selection"))?;

        let mut selection_contexts = Vec::new();
        for selection in selections {
            let Some(sheet) = self.try_sheet(selection.sheet_id) else {
                continue;
            };

            let selection_context = sheet.get_ai_selection_context(
                selection,
                max_rects,
                max_rows,
                include_errored_code_cells,
                include_tables_summary,
                include_charts_summary,
                include_data_rects_summary,
                self.a1_context(),
            );
            selection_contexts.push(selection_context);
        }
        serde_wasm_bindgen::to_value(&selection_contexts).map_err(|e| {
            dbgjs!(format!(
                "[ai_context.rs] error occurred while serializing selection_contexts: {:?}",
                e
            ));
            JsValue::UNDEFINED
        })
    }

    /// gets all tables (data, code, charts) in the grid, single cell (data,
    /// code) tables are not included returns an array of JsTablesContext for
    /// all tables in the grid
    #[wasm_bindgen(js_name = "getAITablesContext")]
    pub fn js_get_ai_tables_context(&self, sample_rows: usize) -> Result<JsValue, JsValue> {
        let mut tables: Vec<JsTablesContext> = Vec::new();
        for sheet in self.grid().sheets().values() {
            if let Some(tables_in_sheet) = sheet.get_ai_tables_context(sample_rows) {
                tables.push(tables_in_sheet);
            }
        }
        serde_wasm_bindgen::to_value(&tables).map_err(|e| {
            dbgjs!(format!(
                "[ai_context.rs] error occurred while serializing tables context: {:?}",
                e
            ));
            JsValue::UNDEFINED
        })
    }

    /// Returns all code cells with errors or spills in all sheets. Returns
    /// undefined if there are no errors or spills in the file.
    #[wasm_bindgen(js_name = "getAICodeErrors")]
    pub fn js_get_ai_code_errors(&self, max_errors: usize) -> Result<JsValue, JsValue> {
        let mut errors = HashMap::new();

        for sheet in self.grid().sheets().values() {
            let sheet_errors = sheet.get_ai_code_errors(max_errors);
            if !sheet_errors.is_empty() {
                errors.insert(sheet.name.clone(), sheet_errors);
            }
        }
        if errors.is_empty() {
            Ok(JsValue::UNDEFINED)
        } else {
            serde_wasm_bindgen::to_value(&errors).map_err(|e| {
                dbgjs!(format!(
                    "[ai_context.rs] error occurred while serializing code errors: {:?}",
                    e
                ));
                JsValue::UNDEFINED
            })
        }
    }
}
