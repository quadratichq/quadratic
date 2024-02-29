use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Pos};

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importCsv")]
    pub fn js_import_csv(
        &mut self,
        sheet_id: &str,
        file: &[u8],
        file_name: &str,
        insert_at: &Pos,
        cursor: Option<String>,
    ) -> JsValue {
        let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
            return JsValue::from_str("Invalid sheet");
        };
        match self.import_csv(sheet_id, file, file_name, *insert_at, cursor) {
            Ok(_) => JsValue::UNDEFINED,
            Err(e) => JsValue::from_str(&e.to_string()),
        }
    }
}
