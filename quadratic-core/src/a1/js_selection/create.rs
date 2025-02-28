//! Utility functions to creates selections for use in JS via
//! quadratic-rust-client.

use wasm_bindgen::prelude::*;

use crate::a1::{A1Context, CellRefRange};

use super::*;

impl Default for JsSelection {
    /// Returns a default JsSelection. Note: this is not a valid selection, but
    /// is used as a way to avoid unwraps in new.
    fn default() -> Self {
        JsSelection {
            selection: A1Selection::from_xy(1, 1, SheetId::TEST),
            context: A1Context::default(),
        }
    }
}

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(constructor)]
    pub fn new(sheet_id: String, context: &str) -> Self {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            dbgjs!("Unable to parse sheet_id in JsSelection::new");
            return JsSelection::default();
        };
        let Ok(context) = serde_json::from_str::<A1Context>(context) else {
            dbgjs!("Unable to parse context in JsSelection::new");
            return JsSelection::default();
        };
        JsSelection {
            selection: A1Selection::from_xy(1, 1, sheet_id),
            context,
        }
    }

    /// Saves the selection to a JSON string.
    #[wasm_bindgen]
    pub fn save(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection).map_err(|e| e.to_string())
    }

    /// Loads the selection from a JSON string.
    #[wasm_bindgen]
    pub fn load(&mut self, selection: String) {
        if let Ok(selection) =
            serde_json::from_str::<A1Selection>(&selection).map_err(|e| e.to_string())
        {
            self.selection = selection;
        }
    }
}

#[wasm_bindgen(js_name = "xyToA1")]
pub fn xy_to_a1(x: i32, y: i32) -> Result<String, String> {
    let pos = Pos::new(x as i64, y as i64);
    Ok(pos.a1_string())
}

#[wasm_bindgen(js_name = "xyxyToA1")]
pub fn xyxy_to_a1(x0: i32, y0: i32, x1: i32, y1: i32) -> Result<String, String> {
    let rect = Rect::new(x0 as i64, y0 as i64, x1 as i64, y1 as i64);
    Ok(rect.a1_string())
}

#[wasm_bindgen(js_name = "rectToA1")]
pub fn rect_to_a1(rect: JsValue) -> Result<String, String> {
    let rect = serde_wasm_bindgen::from_value::<Rect>(rect).map_err(|e| e.to_string())?;
    Ok(rect.a1_string())
}

#[wasm_bindgen(js_name = "stringToSelection")]
pub fn to_selection(
    a1: &str,
    default_sheet_id: &str,
    context: &str,
) -> Result<JsSelection, String> {
    let default_sheet_id = SheetId::from_str(default_sheet_id).map_err(|e| e.to_string())?;
    let context = serde_json::from_str::<A1Context>(context).map_err(|e| e.to_string())?;
    let selection = A1Selection::parse_a1(a1, &default_sheet_id, &context)
        .map_err(|e| serde_json::to_string(&e).unwrap_or(e.to_string()))?;
    Ok(JsSelection { selection, context })
}

#[wasm_bindgen(js_name = "newSingleSelection")]
pub fn new_single_selection(sheet_id: String, x: u32, y: u32) -> Result<JsSelection, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    Ok(JsSelection {
        selection: A1Selection::from_xy(x as i64, y as i64, sheet_id),

        // the context is not important
        context: A1Context::default(),
    })
}

#[wasm_bindgen(js_name = "newRectSelection")]
pub fn new_rect_selection(
    sheet_id: String,
    x0: i64,
    y0: i64,
    x1: i64,
    y1: i64,
) -> Result<String, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    let selection = JsSelection {
        selection: A1Selection::from_rect(SheetRect::new(x0, y0, x1, y1, sheet_id)),

        // the context is not important
        context: A1Context::default(),
    };
    selection.save()
}

#[wasm_bindgen(js_name = "newAllSelection")]
pub fn new_all_selection(sheet_id: String) -> Result<String, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    let selection = JsSelection {
        selection: A1Selection::all(sheet_id),

        // the context is not important
        context: A1Context::default(),
    };
    selection.save()
}

#[wasm_bindgen(js_name = "A1SelectionStringToSelection")]
pub fn a1_selection_string_to_selection(
    a1_selection: &str,
    context: &str,
) -> Result<JsSelection, String> {
    let selection = serde_json::from_str::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    let context = serde_json::from_str::<A1Context>(context).map_err(|e| e.to_string())?;
    Ok(JsSelection { selection, context })
}

#[wasm_bindgen(js_name = "A1SelectionToJsSelection")]
pub fn a1_selection_value_to_selection(
    a1_selection: JsValue,
    context: &str,
) -> Result<JsSelection, String> {
    let selection =
        serde_wasm_bindgen::from_value::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    let context = serde_json::from_str::<A1Context>(context).map_err(|e| e.to_string())?;
    Ok(JsSelection { selection, context })
}

#[wasm_bindgen(js_name = "cellRefRangeToRefRangeBounds")]
pub fn cell_ref_range_to_ref_range_bounds(
    cell_ref_range: String,
    context: &str,
) -> Result<String, String> {
    let cell_ref_range =
        serde_json::from_str::<CellRefRange>(&cell_ref_range).map_err(|e| e.to_string())?;
    let context = serde_json::from_str::<A1Context>(context).map_err(|e| e.to_string())?;
    let ref_range_bounds = match cell_ref_range {
        CellRefRange::Sheet { range } => range,
        CellRefRange::Table { range } => {
            match range.convert_to_ref_range_bounds(false, &context, false, false) {
                Some(ref_range_bounds) => ref_range_bounds,
                None => return Err("Unable to convert table range to ref range bounds".to_string()),
            }
        }
    };
    serde_json::to_string(&ref_range_bounds).map_err(|e| e.to_string())
}
