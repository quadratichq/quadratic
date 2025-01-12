use std::str::FromStr;

use crate::{grid::SheetId, Pos};

use super::A1Context;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "getTableNames")]
pub fn table_names(context: &str) -> Option<String> {
    let context = serde_json::from_str::<A1Context>(context).unwrap();
    let table_names = context.table_names();
    serde_json::to_string(&table_names).ok()
}

#[wasm_bindgen(js_name = "getTableNameFromPos")]
pub fn get_table_from_pos(context: &str, sheet_id: &str, col: u32, row: u32) -> Option<String> {
    let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
        return None;
    };
    let pos = Pos::new(col as i64, row as i64);
    let context = serde_json::from_str::<A1Context>(context).unwrap();
    let table = context.table_from_pos(pos.to_sheet_pos(sheet_id));
    table.map(|t| t.table_name.clone())
}
