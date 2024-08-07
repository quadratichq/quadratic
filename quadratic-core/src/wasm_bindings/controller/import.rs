use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{
    controller::GridController,
    grid::{Grid, SheetId},
    Pos,
};

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importCsv")]
    pub fn js_import_csv(
        &mut self,
        sheet_id: &str,
        file: &[u8],
        file_name: &str,
        insert_at: &str,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let insert_at = serde_json::from_str::<Pos>(insert_at).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
        self.import_csv(sheet_id, file, file_name, insert_at, cursor)
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
            .import_excel(file, file_name, None)
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
    ) -> Result<(), JsValue> {
        self.import_excel(file, file_name, cursor)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importParquet")]
    pub fn js_import_parquet(
        &mut self,
        sheet_id: &str,
        file: Vec<u8>,
        file_name: &str,
        insert_at: &str,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let insert_at = serde_json::from_str::<Pos>(insert_at).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
        self.import_parquet(sheet_id, file, file_name, insert_at, cursor)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
