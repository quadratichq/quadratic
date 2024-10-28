use super::*;
use crate::grid::js_types::*;
use crate::wasm_bindings::controller::sheet_info::SheetInfo;
use js_sys::{ArrayBuffer, Uint8Array};
use std::str::FromStr;

pub mod auto_complete;
pub mod borders;
pub mod bounds;
pub mod cells;
pub mod clipboard;
pub mod code;
pub mod col_row;
pub mod export;
pub mod formatting;
pub mod import;
pub mod render;
pub mod search;
pub mod sheet_info;
pub mod sheet_offsets;
pub mod sheets;
pub mod summarize;
pub mod transactions;
pub mod validation;
pub mod worker;

#[wasm_bindgen]
impl GridController {
    /// Imports a [`GridController`] from a JSON string.
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(
        file: Vec<u8>,
        last_sequence_num: u32,
        initialize: bool,
    ) -> Result<GridController, JsValue> {
        match file::import(file).map_err(|e| e.to_string()) {
            Ok(file) => {
                let mut grid = GridController::from_grid(file, last_sequence_num as u64);

                // populate data for client and text renderer
                if initialize {
                    grid.send_viewport_buffer();

                    // first recalculate all bounds in sheets
                    let mut html = vec![];
                    let sheets_info = grid
                        .sheet_ids()
                        .iter()
                        .filter_map(|sheet_id| {
                            grid.try_sheet(*sheet_id).map(|sheet| {
                                html.extend(sheet.get_html_output());
                                SheetInfo::from(sheet)
                            })
                        })
                        .collect::<Vec<SheetInfo>>();
                    if let Ok(sheets_info) = serde_json::to_string(&sheets_info) {
                        crate::wasm_bindings::js::jsSheetInfo(sheets_info);
                    }
                    if !html.is_empty() {
                        if let Ok(html) = serde_json::to_string(&html) {
                            crate::wasm_bindings::js::jsHtmlOutput(html);
                        }
                    }
                    grid.sheet_ids().iter().for_each(|sheet_id| {
                        let fills = grid.sheet_fills(*sheet_id);
                        if let Ok(fills) = serde_json::to_string(&fills) {
                            crate::wasm_bindings::js::jsSheetFills(sheet_id.to_string(), fills);
                        }
                        if let Some(sheet) = grid.try_sheet(*sheet_id) {
                            let code = sheet.get_all_render_code_cells();
                            if !code.is_empty() {
                                if let Ok(code) = serde_json::to_string(&code) {
                                    crate::wasm_bindings::js::jsSheetCodeCell(
                                        sheet_id.to_string(),
                                        code,
                                    );
                                }
                            }
                            // sends all sheet fills to the client
                            sheet.send_sheet_fills();

                            // sends all images to the client
                            sheet.send_all_images();

                            // sends all validations to the client
                            sheet.send_all_validations();

                            // sends all validation warnings to the client
                            sheet.send_all_validation_warnings();

                            // sends all borders to the client
                            sheet.borders.send_sheet_borders(*sheet_id);
                        }
                    });
                }
                Ok(grid)
            }
            Err(e) => Err(JsValue::from_str(&format!("Failed to import grid: {}", e))),
        }
    }

    #[wasm_bindgen(js_name = "test")]
    #[cfg(test)]
    pub fn js_test() -> GridController {
        GridController::test()
    }

    /// Exports a [`GridController`] to a file (consumes the grid). Returns a `ArrayBuffer`.
    /// This is useful when exporting the grid to a file from dashboard, saves memory while exporting.
    #[wasm_bindgen(js_name = "exportGridToFile")]
    pub fn js_export_grid_to_file(self) -> Result<ArrayBuffer, JsValue> {
        match file::export(self.into_grid()) {
            Ok(file) => Ok(Uint8Array::from(&file[..]).buffer()),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    /// Exports a [`GridController`] to a file (exports the grid using clone). Returns a `ArrayBuffer`.
    /// This is required when exporting the open file from app, requires a clone because the grid is still being used.
    #[wasm_bindgen(js_name = "exportOpenGridToFile")]
    pub fn js_export_open_grid_to_file(&self) -> Result<ArrayBuffer, JsValue> {
        match file::export(self.grid().clone()) {
            Ok(file) => Ok(Uint8Array::from(&file[..]).buffer()),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    /// Exports a [`string`]
    #[wasm_bindgen(js_name = "getVersion")]
    pub fn js_file_version(&self) -> String {
        file::CURRENT_VERSION.into()
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
}
