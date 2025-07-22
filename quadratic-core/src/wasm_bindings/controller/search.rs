use super::*;

#[allow(non_snake_case)]
#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "search")]
    pub fn search(&self, query: String, options: JsValue) -> JsValue {
        let options = serde_wasm_bindgen::from_value(options).unwrap_or_default();
        let search = self.grid().search(&query, options);
        serde_wasm_bindgen::to_value(&search).unwrap_or(JsValue::UNDEFINED)
    }

    #[wasm_bindgen(js_name = "neighborText")]
    pub fn neighbor_text(&self, sheet_id: String, x: i64, y: i64) -> JsValue {
        let text = match self.try_sheet_from_string_id(&sheet_id) {
            Some(sheet) => sheet.neighbor_text(Pos { x, y }),
            None => vec![],
        };
        serde_wasm_bindgen::to_value(&text).unwrap_or(JsValue::UNDEFINED)
    }
}
