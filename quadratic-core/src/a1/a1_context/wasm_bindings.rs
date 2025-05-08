use std::str::FromStr;

use crate::{Pos, a1::A1Selection, grid::SheetId};

use super::A1Context;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = "getTableInfo")]
pub fn table_names(context: &str) -> Result<JsValue, String> {
    let context = serde_json::from_str::<A1Context>(context).unwrap();
    let table_info = context.table_info();
    serde_wasm_bindgen::to_value(&table_info).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "getTableNameFromPos")]
pub fn get_table_from_pos(context: &str, sheet_id: &str, col: u32, row: u32) -> Option<String> {
    let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
        return None;
    };
    let pos = Pos::new(col as i64, row as i64);
    let context = serde_json::from_str::<A1Context>(context).unwrap();
    let table = context.table_from_pos(pos.to_sheet_pos(sheet_id));
    table.map(|t| t.table_name.to_string())
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

#[wasm_bindgen(js_name = "getTableNameInNameOrColumn")]
pub fn get_table_name_in_name_or_column(
    sheet_id: &str,
    x: u32,
    y: u32,
    context: &str,
) -> Option<String> {
    let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
        return None;
    };
    let Ok(context) = serde_json::from_str::<A1Context>(context) else {
        return None;
    };
    context.table_in_name_or_column(sheet_id, x, y)
}

#[wasm_bindgen(js_name = "selectionToSheetRect")]
pub fn selection_to_sheet_rect(sheet_name: &str, selection: &str) -> Result<String, String> {
    let sheet_id = SheetId::from_str(sheet_name).map_err(|e| format!("Sheet not found: {e}"))?;
    let selection = serde_json::from_str::<A1Selection>(selection)
        .map_err(|e| format!("Invalid selection: {e}"))?;
    let range = selection
        .ranges
        .first()
        .ok_or("Invalid selection: no ranges")?;
    // we don't really need the context here, but we need to pass something
    let context = A1Context::default();
    let rect = range
        .to_rect(&context)
        .ok_or("Invalid selection: not a rectangle")?;
    let sheet_rect = rect.to_sheet_rect(sheet_id);
    Ok(serde_json::to_string(&sheet_rect).map_err(|e| e.to_string())?)
}
