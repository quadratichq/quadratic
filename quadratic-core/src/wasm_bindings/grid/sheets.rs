use super::*;
use crate::grid::*;

#[wasm_bindgen]
impl Grid {
    #[wasm_bindgen(js_name = "getSheetMetaData")]
    pub fn get_sheet_metadata(&self, sheet_id: String) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_string(&sheet_id);
        let sheet = self.sheet_from_id(sheet_id);
        Ok(serde_json::to_string(&sheet.get_meta_data()).map_err(|e| e.to_string())?)
    }
}
