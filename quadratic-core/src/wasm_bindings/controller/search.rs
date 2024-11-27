use super::*;

#[allow(non_snake_case)]
#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "search")]
    pub fn search(&self, query: String, options: JsValue) -> Result<JsValue, JsValue> {
        let options = serde_wasm_bindgen::from_value(options)?;
        let search = self.grid().search(&query, options);
        Ok(serde_wasm_bindgen::to_value(&search)?)
    }

    #[wasm_bindgen(js_name = "neighborText")]
    pub fn neighbor_text(&self, sheet_id: String, x: i64, y: i64) -> Result<JsValue, JsValue> {
        let sheet = self
            .try_sheet_from_string_id(sheet_id)
            .ok_or(JsValue::UNDEFINED)?;
        let text = sheet.neighbor_text(Pos { x, y });
        Ok(serde_wasm_bindgen::to_value(&text).map_err(|_| JsValue::UNDEFINED)?)
    }
}
