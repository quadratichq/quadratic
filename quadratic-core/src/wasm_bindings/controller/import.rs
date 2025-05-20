use std::str::FromStr;

use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::Pos;
use crate::controller::GridController;
use crate::grid::js_types::JsResponse;
use crate::grid::{Grid, SheetId};

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "getCsvPreview")]
    pub fn js_get_csv_preview(
        file: Vec<u8>,
        max_rows: u32,
        delimiter: Option<u8>,
    ) -> Result<JsValue, JsValue> {
        let preview = GridController::get_csv_preview(file, max_rows, delimiter);
        match preview {
            Ok(preview) => Ok(serde_wasm_bindgen::to_value(&preview)?),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    #[wasm_bindgen(js_name = "importCsv")]
    pub fn js_import_csv(
        file: Vec<u8>,
        file_name: &str,
        delimiter: Option<u8>,
        header_is_first_row: Option<bool>,
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
        file: Vec<u8>,
        file_name: &str,
        sheet_id: &str,
        insert_at: &str,
        cursor: Option<String>,
        delimiter: Option<u8>,
        header_is_first_row: Option<bool>,
    ) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
        let insert_at = serde_json::from_str::<Pos>(insert_at).map_err(|e| e.to_string())?;
        self.import_csv(
            sheet_id,
            file,
            file_name,
            insert_at,
            cursor,
            delimiter,
            header_is_first_row,
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importExcel")]
    pub fn js_import_excel(file: Vec<u8>, file_name: &str) -> Result<GridController, JsValue> {
        let grid = Grid::new_blank();
        let mut grid_controller = GridController::from_grid(grid, 0);
        grid_controller
            .import_excel(&file, file_name, None)
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
    ) -> Result<JsValue, JsValue> {
        match self.import_excel(&file, file_name, cursor) {
            Ok(_) => Ok(serde_wasm_bindgen::to_value(&JsResponse {
                result: true,
                error: None,
            })?),
            Err(e) => {
                let error = format!(
                    "Error importing Excel file: {:?}, error: {:?}",
                    file_name, e
                );
                dbgjs!(&error);
                Ok(serde_wasm_bindgen::to_value(&JsResponse {
                    result: false,
                    error: Some(error),
                })?)
            }
        }
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
        grid_controller
            .import_parquet(sheet_id, file, file_name, insert_at, None)
            .map_err(|e| e.to_string())?;

        Ok(grid_controller)
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importParquetIntoExistingFile")]
    pub fn js_import_parquet_into_existing_file(
        &mut self,
        file: Vec<u8>,
        file_name: &str,
        sheet_id: &str,
        insert_at: &str,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
        let insert_at = serde_json::from_str::<Pos>(insert_at).map_err(|e| e.to_string())?;
        self.import_parquet(sheet_id, file, file_name, insert_at, cursor)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
