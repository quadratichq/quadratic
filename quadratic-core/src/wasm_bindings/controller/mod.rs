use super::*;
use crate::grid::js_types::*;

use crate::wasm_bindings::controller::sheet_info::SheetInfo;
use std::str::FromStr;
use util::set_panic_hook;

pub mod ai_context;
pub mod auto_complete;
pub mod borders;
pub mod cells;
pub mod clipboard;
pub mod code;
pub mod col_row;
pub mod conditional_format;
pub mod data_table;
pub mod export;
pub mod formatting;
pub mod import;
pub mod merge_cells;
pub mod render;
pub mod search;
pub mod sheet_info;
pub mod sheet_offsets;
pub mod sheets;
pub mod summarize;
pub mod transactions;
pub mod validation;

#[wasm_bindgen]
impl GridController {
    /// Imports a [`GridController`] from a JSON string.
    #[wasm_bindgen(js_name = "newFromFile")]
    pub fn js_new_from_file(
        file: Vec<u8>,
        last_sequence_num: u32,
        initialize: bool,
    ) -> Result<GridController, JsValue> {
        set_panic_hook();

        let mut grid = match file::import(file).map_err(|e| e.to_string()) {
            Ok(file) => {
                let mut grid = GridController::from_grid(file, last_sequence_num as u64);

                // populate data for client and text renderer
                if initialize {
                    grid.send_viewport_buffer();

                    // a1 context needs to be sent before SheetInfo
                    grid.send_a1_context();

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
                        .collect::<Vec<_>>();
                    if let Ok(sheets_info) = serde_json::to_vec(&sheets_info) {
                        crate::wasm_bindings::js::jsSheetInfo(sheets_info);
                    }
                    drop(sheets_info);

                    let a1_context = grid.a1_context();
                    grid.sheet_ids().iter().for_each(|sheet_id| {
                        if let Some(sheet) = grid.try_sheet(*sheet_id) {
                            // sends SheetContentCache to the client
                            sheet.send_content_cache();

                            // sends SheetDataTablesCache to the client
                            sheet.send_data_tables_cache();

                            // sends all code cells to the client
                            sheet.send_all_render_code_cells();

                            // sends all images to the client
                            sheet.send_all_images();

                            // sends all validations to the client
                            sheet.send_all_validations();

                            // sends all validation warnings to the client
                            sheet.send_all_validation_warnings();

                            // sends all conditional formats to the client
                            sheet.send_all_conditional_formats(a1_context);

                            // sends all borders to the client
                            sheet.send_sheet_borders();

                            // sends all merge cells to the client
                            sheet.send_merge_cells();
                        }
                    });

                    if !html.is_empty()
                        && let Ok(html) = serde_json::to_vec(&html)
                    {
                        crate::wasm_bindings::js::jsHtmlOutput(html);
                    }
                    drop(html);
                }
                grid
            }
            Err(e) => return Err(JsValue::from_str(&format!("Failed to import grid: {e}"))),
        };

        grid = grid.apply_callbacks();

        Ok(grid)
    }

    #[wasm_bindgen(js_name = "test")]
    #[cfg(test)]
    pub fn js_test() -> GridController {
        GridController::test()
    }

    /// Exports a [`GridController`] to a file (consumes the grid). Returns a `Vec<u8>`.
    /// This is useful when exporting the grid to a file from dashboard, saves memory while exporting.
    #[wasm_bindgen(js_name = "exportGridToFile")]
    pub fn js_export_grid_to_file(self) -> Result<Vec<u8>, JsValue> {
        match file::export(self.into_grid()) {
            Ok(file) => Ok(file),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    /// Exports a [`GridController`] to a file (exports the grid using clone). Returns a `Vec<u8>`.
    /// This is required when exporting the open file from app, requires a clone because the grid is still being used.
    #[wasm_bindgen(js_name = "exportOpenGridToFile")]
    pub fn js_export_open_grid_to_file(&self) -> Result<Vec<u8>, JsValue> {
        match file::export(self.grid().clone()) {
            Ok(file) => Ok(file),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    /// Exports a [`GridController`] to a JSON string for debugging.
    #[wasm_bindgen(js_name = "exportOpenGridToJson")]
    pub fn js_export_open_grid_to_json(&self) -> Result<String, JsValue> {
        match file::export_json(self.grid().clone()) {
            Ok(bytes) => {
                String::from_utf8(bytes).map_err(|e| JsValue::from_str(&e.to_string()))
            }
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

    /// Undoes count transactions.
    #[wasm_bindgen(js_name = "undo")]
    pub fn js_undo(&mut self, count: usize, cursor: Option<String>, is_ai: bool) -> JsValue {
        capture_core_error(|| Ok(Some(JsValue::from_str(&self.undo(count, cursor, is_ai)))))
    }
    /// Redoes count transactions.
    #[wasm_bindgen(js_name = "redo")]
    pub fn js_redo(&mut self, count: usize, cursor: Option<String>, is_ai: bool) -> JsValue {
        capture_core_error(|| Ok(Some(JsValue::from_str(&self.redo(count, cursor, is_ai)))))
    }

    // /// Checks for pending callbacks without blocking.
    // /// Returns the callback if available, or None if no callbacks are pending.
    // #[cfg(target_family = "wasm")]
    // pub fn try_receive_callback(&self) {
    //     println!("trying to receive callback");
    //     if let Ok(callback) = self.receive_callback() {
    //         match callback {
    //             Callback::RunPython(python_callback) => {
    //                 let PythonCallback {
    //                     transaction_id,
    //                     x,
    //                     y,
    //                     sheet_id,
    //                     code,
    //                 } = python_callback;
    //                 crate::wasm_bindings::js::jsRunPython(transaction_id, x, y, sheet_id, code);
    //             }
    //         }
    //     }
    // }
}
