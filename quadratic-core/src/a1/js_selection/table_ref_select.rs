use wasm_bindgen::prelude::*;

use super::*;

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(js_name = "selectTable")]
    pub fn select_table(&mut self, table_name: &str, col: Option<String>, append: bool) {
        self.selection.select_table(table_name, col, append);
    }
}
