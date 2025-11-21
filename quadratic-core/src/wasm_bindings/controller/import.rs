use std::str::FromStr;

use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::Pos;
use crate::controller::GridController;
use crate::grid::{Grid, SheetId};
use crate::wasm_bindings::capture_core_error;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importCsv")]
    pub fn js_import_csv(
        file: &[u8],
        file_name: &str,
        delimiter: Option<u8>,
        header_is_first_row: Option<bool>,
        is_overwrite_table: Option<bool>,
    ) -> Result<GridController, JsValue> {
        let mut grid = Grid::new_blank();
        let sheet_id = grid.add_sheet(None);
        let insert_at = pos![A1];

        let mut grid_controller = GridController::from_grid(grid, 0);
        grid_controller
            .import_csv(
                sheet_id,
                file,
                file_name,
                insert_at,
                None,
                delimiter,
                header_is_first_row,
                false,
                is_overwrite_table.unwrap_or(false),
            )
            .map_err(|e| e.to_string())?;

        Ok(grid_controller)
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importCsvIntoExistingFile")]
    #[allow(clippy::too_many_arguments)]
    pub fn js_import_csv_into_existing_file(
        &mut self,
        file: &[u8],
        file_name: &str,
        sheet_id: &str,
        insert_at: &str,
        cursor: Option<String>,
        delimiter: Option<u8>,
        header_is_first_row: Option<bool>,
        is_ai: bool,
        is_overwrite_table: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
            let insert_at = serde_json::from_str::<Pos>(insert_at).map_err(|e| e.to_string())?;
            let response_prompt = self
                .import_csv(
                    sheet_id,
                    file,
                    file_name,
                    insert_at,
                    cursor,
                    delimiter,
                    header_is_first_row,
                    is_ai,
                    is_overwrite_table,
                )
                .map_err(|e| format!("Error importing CSV file: {file_name:?}, error: {e:?}"))?;

            Ok(Some(JsValue::from_str(&response_prompt)))
        })
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importExcel")]
    pub fn js_import_excel(file: Vec<u8>, file_name: &str) -> Result<GridController, JsValue> {
        let grid = Grid::new_blank();
        let mut grid_controller = GridController::from_grid(grid, 0);
        grid_controller
            .import_excel(&file, file_name, None, false)
            .map_err(|e| e.to_string())?;

        Ok(grid_controller)
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importExcelIntoExistingFile")]
    pub fn js_import_excel_into_existing_file(
        &mut self,
        file: Vec<u8>,
        file_name: &str,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let response_prompt = self
                .import_excel(&file, file_name, cursor, is_ai)
                .map_err(|e| format!("Error importing Excel file: {file_name:?}, error: {e:?}"))?;

            Ok(Some(JsValue::from_str(&response_prompt)))
        })
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importParquet")]
    pub fn js_import_parquet(file: Vec<u8>, file_name: &str) -> Result<GridController, JsValue> {
        let mut grid = Grid::new_blank();
        let sheet_id = grid.add_sheet(None);
        let insert_at = pos![A1];
        let mut grid_controller = GridController::from_grid(grid, 0);
        let updater = Some(crate::wasm_bindings::js::jsImportProgress);

        grid_controller
            .import_parquet(
                sheet_id, file, file_name, insert_at, None, updater, false, false,
            )
            .map_err(|e| e.to_string())?;

        Ok(grid_controller)
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importParquetIntoExistingFile")]
    #[allow(clippy::too_many_arguments)]
    pub fn js_import_parquet_into_existing_file(
        &mut self,
        file: Vec<u8>,
        file_name: &str,
        sheet_id: &str,
        insert_at: &str,
        cursor: Option<String>,
        is_ai: bool,
        is_overwrite_table: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(sheet_id).map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let insert_at = serde_json::from_str::<Pos>(insert_at)
                .map_err(|e| format!("Unable to parse Pos: {e}"))?;

            let updater = Some(crate::wasm_bindings::js::jsImportProgress);

            let response_prompt = self
                .import_parquet(
                    sheet_id,
                    file,
                    file_name,
                    insert_at,
                    cursor,
                    updater,
                    is_ai,
                    is_overwrite_table,
                )
                .map_err(|e| {
                    format!("Error importing Parquet file: {file_name:?}, error: {e:?}")
                })?;

            Ok(Some(JsValue::from_str(&response_prompt)))
        })
    }
}
