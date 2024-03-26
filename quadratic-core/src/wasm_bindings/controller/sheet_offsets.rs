use crate::sheet_offsets::SheetOffsets;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Gets a local copy of SheetOffsets for a sheet.
    /// Returns a [`SheetOffsets`].
    #[wasm_bindgen(js_name = "getOffsets")]
    pub fn js_get_offsets(&self, sheet_id: String) -> SheetOffsets {
        // todo: should return a result
        let sheet = self.try_sheet_from_string_id(sheet_id).unwrap();
        sheet.offsets.clone()
    }

    #[wasm_bindgen(js_name = "exportOffsets")]
    pub fn js_export_offsets(&self, sheet_id: String) -> Result<String, JsValue> {
        if let Some(sheet) = self.try_sheet_from_string_id(sheet_id) {
            if let Ok(offsets) = serde_json::to_string(&sheet.offsets) {
                Ok(offsets)
            } else {
                Err(JsValue::from_str("Failed to serialize offsets"))
            }
        } else {
            Err(JsValue::from_str("Sheet not found"))
        }
    }

    #[wasm_bindgen(js_name = "commitOffsetsResize")]
    pub fn js_commit_resize(
        &mut self,
        sheet_id: String,
        transient_resize: Option<String>,
        cursor: Option<String>,
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
                            "Failed to parse transient resize: {}",
                            e
                        )));
                    }
                };
                self.commit_offsets_resize(sheet_id, transient_resize, cursor);
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
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.commit_single_resize(
            sheet_id, column, row, size, cursor,
        ))?)
    }
}
