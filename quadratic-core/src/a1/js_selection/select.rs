use wasm_bindgen::prelude::*;

use crate::a1::A1Context;

use super::*;

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(js_name = "selectTable")]
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        append: bool,
        context: &str,
    ) {
        if let Ok(context) = serde_json::from_str::<A1Context>(context) {
            self.selection
                .select_table(table_name, col, append, &context);
        }
    }
}
