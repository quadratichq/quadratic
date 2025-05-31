use std::str::FromStr;

use crate::{Pos, a1::A1Selection, grid::SheetId};

use crate::a1::{A1Context, RefRangeBounds};
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

#[wasm_bindgen(js_name = "selectionToSheetRect")]
pub fn selection_to_sheet_rect(
    sheet_id: &str,
    selection: &str,
    context: &[u8],
) -> Result<String, String> {
    // we don't need a real context since we're creating a table, so there should be no need for table info
    let sheet_id = SheetId::from_str(sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
    let context = serde_json::from_slice::<A1Context>(context)
        .map_err(|e| format!("Error parsing context: {e}"))?;
    let selection = A1Selection::parse_a1(selection, sheet_id, &context)
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
    serde_json::to_string(&sheet_rect).map_err(|e| e.to_string())
}
