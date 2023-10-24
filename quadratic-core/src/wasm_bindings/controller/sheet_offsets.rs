use crate::sheet_offsets::{resize_transient::TransientResize, SheetOffsets};

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Gets a local copy of SheetOffsets for a sheet.
    /// Returns a [`SheetOffsets`].
    #[wasm_bindgen(js_name = "getOffsets")]
    pub fn js_get_offsets(&self, sheet_id: String) -> SheetOffsets {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let sheet = self.sheet(sheet_id);
        sheet.offsets.clone()
    }

    /// Commits a resize operation. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "commitOffsetsResize")]
    pub fn js_commit_resize(
        &mut self,
        sheet_id: String,
        transient_resize: Option<TransientResize>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.commit_offsets_resize(
            sheet_id,
            transient_resize,
            cursor,
        ))?)
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
        let transient_resize = match (column, row) {
            (Some(column), None) => Some(TransientResize::column(column as i64, size)),
            (None, Some(row)) => Some(TransientResize::row(row as i64, size)),
            _ => None,
        };
        Ok(serde_wasm_bindgen::to_value(&self.commit_offsets_resize(
            sheet_id,
            transient_resize,
            cursor,
        ))?)
    }
}
