use super::*;

#[wasm_bindgen]
impl GridController {
    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "deleteColumns")]
    pub fn js_delete_columns(&mut self, sheet_id: &str, columns: String, cursor: Option<String>) {
        if let (Ok(sheet_id), Ok(columns)) =
            (SheetId::from_str(sheet_id), serde_json::from_str(&columns))
        {
            self.delete_columns(sheet_id, columns, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "insertColumn")]
    pub fn js_insert_column(
        &mut self,
        sheet_id: &str,
        column: i64,
        after: bool,
        cursor: Option<String>,
    ) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.insert_column(sheet_id, column, after, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "deleteRows")]
    pub fn js_delete_row(&mut self, sheet_id: &str, rows: String, cursor: Option<String>) {
        if let (Ok(sheet_id), Ok(rows)) = (SheetId::from_str(sheet_id), serde_json::from_str(&rows))
        {
            self.delete_rows(sheet_id, rows, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "insertRow")]
    pub fn js_insert_row(&mut self, sheet_id: &str, row: i64, after: bool, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.insert_row(sheet_id, row, after, cursor);
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "moveColumns")]
    pub fn js_move_columns(
        &mut self,
        sheet_id: &str,
        col_start: i32,
        col_end: i32,
        to: i32,
        cursor: Option<String>,
    ) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.move_columns(
                sheet_id,
                col_start as i64,
                col_end as i64,
                to as i64,
                cursor,
            );
        }
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "moveRows")]
    pub fn js_move_rows(
        &mut self,
        sheet_id: &str,
        row_start: i32,
        row_end: i32,
        to: i32,
        cursor: Option<String>,
    ) {
        if let Ok(sheet_id) = SheetId::from_str(sheet_id) {
            self.move_rows(
                sheet_id,
                row_start as i64,
                row_end as i64,
                to as i64,
                cursor,
            );
        }
    }
}
