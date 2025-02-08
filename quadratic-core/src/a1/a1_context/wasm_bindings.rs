use std::str::FromStr;

use crate::{grid::SheetId, Pos};

use super::A1Context;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "getTableInfo")]
pub fn table_names(context: &str) -> JsValue {
    let context = serde_json::from_str::<A1Context>(context).unwrap();
    let table_info = context.table_info();
    serde_wasm_bindgen::to_value(&table_info).unwrap_or(JsValue::UNDEFINED)
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

/// Converts a table reference to an A1 range.
#[wasm_bindgen(js_name = "convertTableToRange")]
pub fn convert_table_to_range(
    context: &str,
    table_name: &str,
    current_sheet_id: &str,
) -> Result<String, String> {
    let context = serde_json::from_str::<A1Context>(context).map_err(|e| e.to_string())?;
    let sheet_id =
        SheetId::from_str(current_sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
    context
        .convert_table_to_range(table_name, sheet_id)
        .map_err(|e| e.to_string())
}
