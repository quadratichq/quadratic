use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "exportMetadata")]
    pub fn js_export_metadata(&self) -> String {
        self.grid().export_metadata()
    }
}
