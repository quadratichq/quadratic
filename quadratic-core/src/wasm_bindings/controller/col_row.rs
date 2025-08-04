use super::*;

#[wasm_bindgen]
impl GridController {
    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "deleteColumns")]
    pub fn js_delete_columns(
        &mut self,
        sheet_id: String,
        columns: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let columns = serde_json::from_str(&columns)
                .map_err(|e| format!("Unable to parse columns: {e}"))?;
            self.delete_columns(sheet_id, columns, cursor, is_ai);
            Ok(None)
        })
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "insertColumns")]
    pub fn js_insert_columns(
        &mut self,
        sheet_id: String,
        column: i64,
        count: i32,
        after: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let count = count.max(1);
            self.insert_columns(sheet_id, column, count as u32, after, cursor, is_ai);
            Ok(None)
        })
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "deleteRows")]
    pub fn js_delete_row(
        &mut self,
        sheet_id: String,
        rows: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let rows =
                serde_json::from_str(&rows).map_err(|e| format!("Unable to parse rows: {e}"))?;
            self.delete_rows(sheet_id, rows, cursor, is_ai);
            Ok(None)
        })
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "insertRows")]
    pub fn js_insert_rows(
        &mut self,
        sheet_id: String,
        row: i64,
        count: i32,
        after: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let count = count.max(1);
            self.insert_rows(sheet_id, row, count as u32, after, cursor, is_ai);
            Ok(None)
        })
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "moveColumns")]
    pub fn js_move_columns(
        &mut self,
        sheet_id: String,
        col_start: i32,
        col_end: i32,
        to: i32,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            self.move_columns(
                sheet_id,
                col_start as i64,
                col_end as i64,
                to as i64,
                cursor,
                is_ai,
            );
            Ok(None)
        })
    }

    #[allow(non_snake_case)]
    #[wasm_bindgen(js_name = "moveRows")]
    pub fn js_move_rows(
        &mut self,
        sheet_id: String,
        row_start: i32,
        row_end: i32,
        to: i32,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            self.move_rows(
                sheet_id,
                row_start as i64,
                row_end as i64,
                to as i64,
                cursor,
                is_ai,
            );
            Ok(None)
        })
    }
}
