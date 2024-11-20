use std::str::FromStr;

use quadratic_core::{grid::SheetId, A1Selection, CellRefRange, Rect, SheetNameIdMap};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct Selection {
    selection: A1Selection,
}

#[wasm_bindgen]
impl Selection {
    #[wasm_bindgen(constructor)]
    pub fn new(sheet_id: String) -> Self {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Selection {
            selection: A1Selection::from_xy(1, 1, sheet_id),
        }
    }

    #[wasm_bindgen(js_name = "getSheetId")]
    pub fn sheet_id(&self) -> String {
        self.selection.sheet_id.to_string()
    }

    /// Saves the selection to a JSON string.
    #[wasm_bindgen]
    pub fn save(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection).map_err(|e| e.to_string())
    }

    /// Loads the selection from a JSON string.
    #[wasm_bindgen]
    pub fn load(selection: String) -> Result<Selection, String> {
        let selection: A1Selection = serde_json::from_str(&selection).map_err(|e| e.to_string())?;
        Ok(Selection { selection })
    }

    /// Returns the cursor position (as a JsCoordinate)
    #[wasm_bindgen(js_name = "getCursor")]
    pub fn cursor(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.cursor.x as u32,
            y: self.selection.cursor.y as u32,
        }
    }

    /// Selects the entire sheet.
    #[wasm_bindgen(js_name = "selectAll")]
    pub fn select_all(&mut self) {
        self.selection.select_all();
    }

    #[wasm_bindgen(js_name = "selectColumn")]
    pub fn select_column(&mut self, column: u32, append: bool) {
        self.selection.select_column(column, append);
    }

    #[wasm_bindgen(js_name = "selectRow")]
    pub fn select_row(&mut self, row: u32, append: bool) {
        self.selection.select_row(row, append);
    }

    #[wasm_bindgen(js_name = "selectRect")]
    pub fn select_rect(&mut self, left: u32, top: u32, right: u32, bottom: u32, append: bool) {
        let rect = Rect::new(left as i64, top as i64, right as i64, bottom as i64);
        self.selection.select_rect(rect, append);
    }

    #[wasm_bindgen(js_name = "toString")]
    pub fn to_string(&self, default_sheet_id: String, sheet_map: &str) -> Result<String, String> {
        let sheet_map =
            serde_json::from_str::<SheetNameIdMap>(sheet_map).map_err(|e| e.to_string())?;
        let default_sheet_id = SheetId::from_str(&default_sheet_id).map_err(|e| e.to_string())?;
        Ok(self.selection.to_string(Some(default_sheet_id), &sheet_map))
    }

    #[wasm_bindgen(js_name = "deltaSize")]
    pub fn delta_size(&mut self, delta_x: i32, delta_y: i32) {
        self.selection.delta_size(delta_x as i64, delta_y as i64);
    }

    #[wasm_bindgen(js_name = "moveTo")]
    pub fn move_to(&mut self, x: i32, y: i32) {
        self.selection.move_to(x as i64, y as i64);
    }

    #[wasm_bindgen(js_name = "isMultiCursor")]
    pub fn is_multi_cursor(&self) -> bool {
        self.selection.is_multi_cursor()
    }

    #[wasm_bindgen(js_name = "setColumnsSelected")]
    pub fn set_columns_selected(&mut self) {
        self.selection.set_columns_selected();
    }

    #[wasm_bindgen(js_name = "setRowsSelected")]
    pub fn set_rows_selected(&mut self) {
        self.selection.set_rows_selected();
    }

    #[wasm_bindgen(js_name = "getLargestRectangle")]
    pub fn get_largest_rectangle(&self) -> Result<Rect, String> {
        Ok(self.selection.largest_rect())
    }

    #[wasm_bindgen(js_name = "getSingleRectangle")]
    pub fn get_single_rectangle(&self) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect())
    }

    #[wasm_bindgen(js_name = "getSingleRectangleOrCursor")]
    pub fn get_single_rectangle_or_cursor(&self) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect_or_cursor())
    }

    #[wasm_bindgen(js_name = "contains")]
    pub fn contains(&self, x: u32, y: u32) -> bool {
        self.selection.might_contain_xy(x as u64, y as u64)
    }

    #[wasm_bindgen(js_name = "extendSelection")]
    pub fn extend_selection(&mut self, column: u32, row: u32, append: bool) {
        self.selection
            .extend_selection(column as u64, row as u64, append);
    }

    #[wasm_bindgen(js_name = "getRanges")]
    pub fn get_ranges(&self) -> Result<Vec<CellRefRange>, String> {
        Ok(self.selection.ranges.clone())
    }

    #[wasm_bindgen(js_name = "isColumnRow")]
    pub fn is_column_row(&self) -> bool {
        self.selection.is_column_row()
    }

    #[wasm_bindgen(js_name = "overlapsA1Selection")]
    pub fn overlaps_a1_selection(&self, _a1_selection: String) -> bool {
        todo!()
        // self.selection.overlaps_a1_selection(&a1_selection)
    }
}

#[wasm_bindgen(js_name = "stringToSelection")]
pub fn to_selection(
    a1: &str,
    default_sheet_id: &str,
    sheet_map: &str,
) -> Result<Selection, String> {
    let default_sheet_id = SheetId::from_str(default_sheet_id).map_err(|e| e.to_string())?;
    let sheet_map = serde_json::from_str::<SheetNameIdMap>(sheet_map).map_err(|e| e.to_string())?;
    let selection = A1Selection::from_str(&a1, default_sheet_id, &sheet_map)?;
    Ok(Selection { selection })
}

#[wasm_bindgen(js_name = "newSingleSelection")]
pub fn new_single_selection(sheet_id: String, x: u32, y: u32) -> Result<Selection, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    Ok(Selection {
        selection: A1Selection::from_xy(x as i64, y as i64, sheet_id),
    })
}

#[wasm_bindgen(js_name = "A1SelectionStringToSelection")]
pub fn a1_selection_string_to_selection(a1_selection: &str) -> Result<Selection, String> {
    let selection = serde_json::from_str::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    Ok(Selection { selection })
}
