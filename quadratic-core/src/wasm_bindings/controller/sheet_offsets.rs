use uuid::Uuid;

use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "commitOffsetsResize")]
    pub fn js_commit_resize(
        &mut self,
        sheet_id: String,
        transient_resize: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            // sheet may have been deleted before resize is completed
            return Err(JsValue::from_str("Could not deserialize sheet_id"));
        };
        match transient_resize {
            Some(transient_resize) => {
                let transient_resize = match serde_json::from_str(&transient_resize) {
                    Ok(resize) => resize,
                    Err(e) => {
                        return Err(JsValue::from_str(&format!(
                            "Failed to parse transient resize: {e}"
                        )));
                    }
                };
                self.commit_offsets_resize(sheet_id, transient_resize, cursor, is_ai);
                Ok(())
            }
            None => Ok(()),
        }
    }

    /// Commits a single resize operation. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "commitSingleResize")]
    pub fn js_commit_single_resize(
        &mut self,
        sheet_id: String,
        column: Option<i32>,
        row: Option<i32>,
        size: f64,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.commit_single_resize(
            sheet_id, column, row, size, cursor, is_ai,
        ))?)
    }

    #[wasm_bindgen(js_name = "receiveRowHeights")]
    pub fn js_receive_row_heights(
        &mut self,
        transaction_id: String,
        sheet_id: String,
        row_heights: String,
    ) -> Result<JsValue, JsValue> {
        let transaction_id = match Uuid::parse_str(&transaction_id) {
            Ok(transaction_id) => transaction_id,
            Err(e) => return Err(JsValue::from_str(&format!("Invalid transaction id: {e}"))),
        };
        let sheet_id = match SheetId::from_str(&sheet_id) {
            Ok(sheet_id) => sheet_id,
            Err(e) => return Err(JsValue::from_str(&format!("Invalid sheet id: {e}"))),
        };
        let row_heights = match serde_json::from_str::<Vec<JsRowHeight>>(&row_heights) {
            Ok(row_heights) => row_heights,
            Err(e) => return Err(JsValue::from_str(&format!("Invalid row heights: {e}"))),
        };
        Ok(serde_wasm_bindgen::to_value(
            &self.complete_auto_resize_row_heights(transaction_id, sheet_id, row_heights),
        )?)
    }

    #[wasm_bindgen(js_name = "resizeColumns")]
    pub fn js_resize_columns(
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
            self.resize_columns(sheet_id, columns, cursor, is_ai);
            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "resizeRows")]
    pub fn js_resize_rows(
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
            self.resize_rows(sheet_id, rows, cursor, is_ai);
            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "resizeAllColumns")]
    pub fn js_resize_all_columns(
        &mut self,
        sheet_id: String,
        size: f64,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.resize_all_columns(sheet_id, size, cursor, is_ai);
            Ok(())
        } else {
            Err(JsValue::from_str("Failed to parse sheet_id"))
        }
    }

    #[wasm_bindgen(js_name = "resizeAllRows")]
    pub fn js_resize_all_rows(
        &mut self,
        sheet_id: String,
        size: f64,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.resize_all_rows(sheet_id, size, cursor, is_ai);
            Ok(())
        } else {
            Err(JsValue::from_str("Failed to parse sheet_id"))
        }
    }
}
