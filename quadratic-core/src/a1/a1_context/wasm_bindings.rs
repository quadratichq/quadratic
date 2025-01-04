use super::A1Context;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "getTableNames")]
pub fn table_names(context: &str) -> Option<String> {
    let context = serde_json::from_str::<A1Context>(context).unwrap();
    let table_names = context.table_names();
    serde_json::to_string(&table_names).ok()
}
