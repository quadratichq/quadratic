use super::*;

#[wasm_bindgen]
impl GridController {
    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "deleteColumn")]
    pub fn js_delete_column(&mut self, sheet_id: &str, column: i64, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.delete_column(sheet_id, column, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "insertColumn")]
    pub fn js_insert_column(&mut self, sheet_id: &str, column: i64, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.insert_column(sheet_id, column, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "deleteRow")]
    pub fn js_delete_row(&mut self, sheet_id: &str, row: i64, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.delete_row(sheet_id, row, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "insertRow")]
    pub fn js_insert_row(&mut self, sheet_id: &str, row: i64, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.insert_row(sheet_id, row, cursor);
        }
    }
}
