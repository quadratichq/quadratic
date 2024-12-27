//! Utility functions to creates selections for use in JS via
//! quadratic-rust-client.

use wasm_bindgen::prelude::*;

use super::*;

impl Default for JsSelection {
    /// Returns a default JsSelection. Note: this is not a valid selection, but
    /// is used as a way to avoid unwraps in new.
    fn default() -> Self {
        JsSelection {
            selection: A1Selection::from_xy(1, 1, SheetId::test()),
            sheet_id: SheetId::test(),
            table_map: TableMap::default(),
        }
    }
}

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(constructor)]
    pub fn new(sheet_id: String, table_map: String) -> Self {
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            dbgjs!("Unable to parse sheet_id in JsSelection::new");
            return JsSelection::default();
        };
        let Ok(table_map) = serde_json::from_str::<TableMap>(&table_map) else {
            dbgjs!("Unable to parse table_map in JsSelection::new");
            return JsSelection::default();
        };
        JsSelection {
            selection: A1Selection::from_xy(1, 1, sheet_id),
            sheet_id,
            table_map,
        }
    }

    #[wasm_bindgen]
    pub fn set_table_map(&mut self, table_map: String) {
        let Ok(table_map) = serde_json::from_str::<TableMap>(&table_map) else {
            dbgjs!("Unable to parse table_map in set_table_map");
            return;
        };
        self.table_map = table_map;
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

    #[wasm_bindgen(js_name = "stringToSelection")]
    pub fn to_selection(&mut self, a1: &str, default_sheet_id: &str, sheet_map: &str) {
        if let Ok(default_sheet_id) = SheetId::from_str(default_sheet_id) {
            self.sheet_id = default_sheet_id;
            if let Ok(sheet_map) = serde_json::from_str::<SheetNameIdMap>(sheet_map) {
                if let Ok(selection) = A1Selection::from_str(a1, &default_sheet_id, &sheet_map) {
                    self.selection = selection;
                }
            }
        }
    }

    #[wasm_bindgen(js_name = "newSingleSelection")]
    pub fn new_single_selection(&mut self, sheet_id: String, x: u32, y: u32) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.sheet_id = sheet_id;
            self.selection = A1Selection::from_xy(x as i64, y as i64, sheet_id);
        }
    }

    #[wasm_bindgen(js_name = "newRectSelection")]
    pub fn new_rect_selection(&mut self, sheet_id: String, x0: i64, y0: i64, x1: i64, y1: i64) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.sheet_id = sheet_id;
            self.selection = A1Selection::from_rect(SheetRect::new(x0, y0, x1, y1, sheet_id));
        }
    }

    #[wasm_bindgen(js_name = "newAllSelection")]
    pub fn new_all_selection(&mut self, sheet_id: String) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.sheet_id = sheet_id;
            self.selection = A1Selection::all(sheet_id);
        }
    }

    #[wasm_bindgen(js_name = "A1SelectionStringToSelection")]
    pub fn a1_selection_string_to_selection(&mut self, a1_selection: &str) {
        if let Ok(selection) = serde_json::from_str::<A1Selection>(a1_selection) {
            self.selection = selection;
        }
    }

    #[wasm_bindgen(js_name = "A1SelectionValueToSelection")]
    pub fn a1_selection_value_to_selection(&mut self, a1_selection: JsValue) {
        if let Ok(selection) = serde_wasm_bindgen::from_value::<A1Selection>(a1_selection) {
            self.sheet_id = selection.sheet_id;
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
