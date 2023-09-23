use std::str::FromStr;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::{controller::GridController, grid::SheetId, Pos};

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "importCsv")]
    pub fn js_inport_csv(
        &self,
        sheet_id: String,
        file: String,
        insert_at: &Pos,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id)?;

        crate::wasm_bindings::js::log(&(format!("{:?}", file)));

        let output = "";
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }
}
