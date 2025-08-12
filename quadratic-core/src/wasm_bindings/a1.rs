use std::str::FromStr;

use crate::{
    SheetRect,
    a1::{A1Selection, CellRefRange, RefRangeBounds, column_from_name},
    grid::SheetId,
    wasm_bindings::js_selection::JsSelection,
};
use wasm_bindgen::prelude::*;

use super::js_a1_context::JsA1Context;

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

fn selection_to_sheet_rect(
    sheet_id: &str,
    selection: &str,
    context: &JsA1Context,
) -> Result<SheetRect, String> {
    let sheet_id = SheetId::from_str(sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
    let selection = A1Selection::parse_a1(selection, sheet_id, context.get_context())
        .map_err(|e| format!("Invalid selection: {e}"))?;
    let range = selection
        .ranges
        .first()
        .ok_or("Invalid selection: no ranges")?;

    // we don't really need the context here, but we need to pass something
    let rect = range
        .to_rect(context.get_context())
        .ok_or("Invalid selection: not a rectangle")?;
    Ok(rect.to_sheet_rect(sheet_id))
}

#[wasm_bindgen(js_name = "selectionToSheetRect")]
pub fn selection_to_sheet_rect_value(
    sheet_id: &str,
    selection: &str,
    context: &JsA1Context,
) -> Result<JsValue, String> {
    let sheet_rect = selection_to_sheet_rect(sheet_id, selection, context)?;
    serde_wasm_bindgen::to_value(&sheet_rect).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "selectionToSheetRectString")]
pub fn selection_to_sheet_rect_string(
    sheet_id: &str,
    selection: &str,
    context: &JsA1Context,
) -> Result<String, String> {
    let sheet_rect = selection_to_sheet_rect(sheet_id, selection, context)?;
    serde_json::to_string(&sheet_rect).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "stringToSelection")]
pub fn to_selection(
    a1: &str,
    default_sheet_id: &str,
    context: &JsA1Context,
) -> Result<JsSelection, String> {
    let default_sheet_id = SheetId::from_str(default_sheet_id).map_err(|e| e.to_string())?;
    let selection = A1Selection::parse_a1(a1, default_sheet_id, context.get_context())
        .map_err(|e| serde_json::to_string(&e).unwrap_or(e.to_string()))?;
    Ok(JsSelection::new_with_selection(selection))
}

#[wasm_bindgen(js_name = "A1SelectionStringToSelection")]
pub fn a1_selection_string_to_selection(a1_selection: &str) -> Result<JsSelection, String> {
    let selection = serde_json::from_str::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    Ok(JsSelection::new_with_selection(selection))
}

#[wasm_bindgen(js_name = "A1SelectionToJsSelection")]
pub fn a1_selection_value_to_selection(a1_selection: JsValue) -> Result<JsSelection, String> {
    let selection =
        serde_wasm_bindgen::from_value::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    Ok(JsSelection::new_with_selection(selection))
}

#[wasm_bindgen(js_name = "cellRefRangeToRefRangeBounds")]
pub fn cell_ref_range_to_ref_range_bounds(
    cell_ref_range: String,
    show_table_headers_for_python: bool,
    context: &JsA1Context,
) -> Result<JsValue, String> {
    let cell_ref_range =
        serde_json::from_str::<CellRefRange>(&cell_ref_range).map_err(|e| e.to_string())?;
    let ref_range_bounds = match cell_ref_range {
        CellRefRange::Sheet { range } => range,
        CellRefRange::Table { range } => {
            match range.convert_cells_accessed_to_ref_range_bounds(
                show_table_headers_for_python,
                context.get_context(),
            ) {
                Some(ref_range_bounds) => ref_range_bounds,
                None => {
                    return Err("Unable to convert table range to ref range bounds".to_string());
                }
            }
        }
    };
    serde_wasm_bindgen::to_value(&ref_range_bounds).map_err(|e| e.to_string())
}

#[wasm_bindgen(js_name = "getTableInfo")]
pub fn table_names(context: &JsA1Context) -> Result<JsValue, String> {
    let table_info = context.get_context().table_info();
    serde_wasm_bindgen::to_value(&table_info).map_err(|e| e.to_string())
}

/// Converts a table reference to an A1 range.
#[wasm_bindgen(js_name = "convertTableToRange")]
pub fn convert_table_to_range(
    table_name: &str,
    current_sheet_id: &str,
    context: &JsA1Context,
) -> Result<String, String> {
    let sheet_id =
        SheetId::from_str(current_sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
    context
        .get_context()
        .convert_table_to_range(table_name, sheet_id)
        .map_err(|e| e.to_string())
}

/// Converts a table reference to a position.
#[wasm_bindgen(js_name = "convertTableToSheetPos")]
pub fn convert_table_to_sheet_pos(
    table_name: &str,
    context: &JsA1Context,
) -> Result<JsValue, String> {
    if let Some(table) = context.get_context().try_table(table_name) {
        serde_wasm_bindgen::to_value(&(table.bounds.min.to_sheet_pos(table.sheet_id)))
            .map_err(|e| e.to_string())
    } else {
        Err("Table not found".to_string())
    }
}

#[wasm_bindgen(js_name = "columnNameToIndex")]
pub fn column_name_to_index(column: &str) -> Option<i64> {
    column_from_name(column)
}
