use std::str::FromStr;

#[cfg(feature = "js")]
use wasm_bindgen::{JsValue, prelude::*};

use crate::Pos;
use crate::controller::GridController;
use crate::grid::{Grid, SheetId};
use crate::wasm_bindings::capture_core_error;
use crate::wasm_bindings::js::jsImportProgress;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importCsv")]
    pub fn js_import_csv(
        file: &[u8],
        file_name: &str,
        delimiter: Option<u8>,
        header_is_first_row: Option<bool>,
    ) -> Result<GridController, JsValue> {
        let mut grid = Grid::new_blank();
        let sheet_id = grid.add_sheet(None);
        let insert_at = Pos::new(1, 1);

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
            is_ai,
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
        capture_core_error(
            || match self.import_excel(&file, file_name, cursor, is_ai) {
                Ok(_) => Ok(None),
                Err(e) => {
                    let error = format!("Error importing Excel file: {file_name:?}, error: {e:?}");
                    dbgjs!(&error);
                    Err(error)
                }
            },
        )
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importParquet")]
    pub fn js_import_parquet(file: Vec<u8>, file_name: &str) -> Result<GridController, JsValue> {
        let mut grid = Grid::new_blank();
        let sheet_id = grid.add_sheet(None);
        let insert_at = Pos::new(1, 1);
        let mut grid_controller = GridController::from_grid(grid, 0);
        let updater = Some(jsImportProgress);

        grid_controller
            .import_parquet(sheet_id, file, file_name, insert_at, None, updater, false)
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
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
        let insert_at = serde_json::from_str::<Pos>(insert_at).map_err(|e| e.to_string())?;
        let updater = Some(jsImportProgress);

        self.import_parquet(sheet_id, file, file_name, insert_at, cursor, updater, is_ai)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
