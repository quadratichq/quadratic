use std::str::FromStr;

use wasm_bindgen::prelude::*;

use crate::{SheetPos, grid::SheetId};

use super::{A1Context, DataTable, Sheet};

#[wasm_bindgen(js_name = "validateSheetName")]
pub fn js_validate_sheet_name(name: &str, sheet_id: &str, context: &[u8]) -> Result<bool, String> {
    let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
    let context = serde_json::from_slice::<A1Context>(context).map_err(|e| e.to_string())?;
    Sheet::validate_sheet_name(name, sheet_id, &context)
}

#[wasm_bindgen(js_name = "validateTableName")]
pub fn js_validate_table_name(
    name: &str,
    sheet_id: &str,
    x: i32,
    y: i32,
    context: &[u8],
) -> Result<bool, String> {
    let sheet_id = SheetId::from_str(sheet_id).map_err(|e| e.to_string())?;
    let sheet_pos = SheetPos::new(sheet_id, x as i64, y as i64);
    let context = serde_json::from_slice::<A1Context>(context).map_err(|e| e.to_string())?;
    DataTable::validate_table_name(name, sheet_pos, &context)
}

#[wasm_bindgen(js_name = "validateColumnName")]
pub fn js_validate_column_name(
    table_name: &str,
    index: i32,
    column_name: &str,
    context: &[u8],
) -> Result<bool, String> {
    let context = serde_json::from_slice::<A1Context>(context).map_err(|e| e.to_string())?;
    DataTable::validate_column_name(table_name, index as usize, column_name, &context)
}
