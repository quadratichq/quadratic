use super::*;
use crate::grid::borders::BorderChange;
use crate::grid::*;

#[wasm_bindgen]
impl GridController {
    /// Returns a code cell as a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setBorder")]
    pub fn js_set_border(
        &mut self,
        sheet_id: String,
        region: Rect,
        change_border: BorderChange,
        border_type: BorderType,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let sheet = self.grid().sheet_mut_from_id(sheet_id);
        Ok(serde_wasm_bindgen::to_value(&sheet.set_borders(
            sheet_id,
            region,
            change_border,
            border_type,
        ))?)
    }
}
