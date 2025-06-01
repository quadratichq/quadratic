use crate::a1::RefRangeBounds;
use wasm_bindgen::prelude::*;

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
