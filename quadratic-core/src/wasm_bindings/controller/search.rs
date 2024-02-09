use super::*;

#[wasm_bindgen]
impl GridController {
    pub fn search(&self, query: String, options: JsValue) -> Result<JsValue, JsValue> {
        let options = serde_wasm_bindgen::from_value(options)?;
        let search = self.grid().search(&query, options);
        Ok(serde_wasm_bindgen::to_value(&search)?)
    }
}
