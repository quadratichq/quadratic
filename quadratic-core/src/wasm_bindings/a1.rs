use std::str::FromStr;

use crate::Pos;
use crate::a1::{A1Context, RefRangeBounds};
use crate::grid::SheetId;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "getTableInfo")]
pub fn table_names(context: &[u8]) -> Result<JsValue, String> {
    let context = serde_json::from_slice::<A1Context>(context).map_err(|e| e.to_string())?;
    let table_info = context.table_info();
    serde_wasm_bindgen::to_value(&table_info).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "getTableNameFromPos")]
pub fn get_table_from_pos(context: &[u8], sheet_id: &str, col: u32, row: u32) -> Option<String> {
    let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
        return None;
    };
    let pos = Pos::new(col as i64, row as i64);
    let context = serde_json::from_slice::<A1Context>(context).unwrap();
    let table = context.table_from_pos(pos.to_sheet_pos(sheet_id));
    table.map(|t| t.table_name.to_string())
}

/// Converts a table reference to an A1 range.
#[wasm_bindgen(js_name = "convertTableToRange")]
pub fn convert_table_to_range(
    context: &[u8],
    table_name: &str,
    current_sheet_id: &str,
) -> Result<String, String> {
    let context = serde_json::from_slice::<A1Context>(context).map_err(|e| e.to_string())?;
    let sheet_id =
        SheetId::from_str(current_sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
    context
        .convert_table_to_range(table_name, sheet_id)
        .map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "getTableNameInNameOrColumn")]
pub fn get_table_name_in_name_or_column(
    sheet_id: &str,
    x: u32,
    y: u32,
    context: &[u8],
) -> Option<String> {
    let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
        return None;
    };
    let Ok(context) = serde_json::from_slice::<A1Context>(context) else {
        return None;
    };
    context.table_in_name_or_column(sheet_id, x, y)
}

#[wasm_bindgen(js_name = "toggleReferenceTypes")]
pub fn toggle_reference_types(reference: &str) -> Result<String, String> {
    // Check that reference contains both a letter and a number (otherwise we don't toggle it)
    if !reference.chars().any(|c| c.is_alphabetic()) || !reference.chars().any(|c| c.is_numeric()) {
        return Err("Cannot toggle references without both letters and numbers".to_string());
    }

    let mut cell_ref = RefRangeBounds::from_str(reference, None).map_err(|e| e.to_string())?;
    cell_ref.start.toggle_absolute();
    cell_ref.end = cell_ref.start;
    Ok(cell_ref.to_string())
}
