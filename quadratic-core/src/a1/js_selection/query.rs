use wasm_bindgen::prelude::*;

use super::*;

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(js_name = "toCursorA1")]
    pub fn to_cursor_a1(&self) -> Result<String, String> {
        Ok(self.selection.to_cursor_a1())
    }

    #[wasm_bindgen(js_name = "getSheetId")]
    pub fn sheet_id(&self) -> String {
        self.selection.sheet_id.to_string()
    }

    /// Get A1Selection as a JsValue.
    #[wasm_bindgen]
    pub fn selection(&self) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(&self.selection).map_err(|e| e.to_string())
    }

    /// Returns the cursor position (as a JsCoordinate)
    #[wasm_bindgen(js_name = "getCursor")]
    pub fn cursor(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.cursor.x as u32,
            y: self.selection.cursor.y as u32,
        }
    }

    #[wasm_bindgen(js_name = "getSelectionEnd")]
    pub fn get_selection_end(&self) -> JsCoordinate {
        self.selection.last_selection_end().into()
    }

    #[wasm_bindgen(js_name = "getBottomRightCell")]
    pub fn get_bottom_right_cell(&self) -> JsCoordinate {
        self.selection.bottom_right_cell().into()
    }

    #[wasm_bindgen(js_name = "getLargestRectangle")]
    pub fn get_largest_rectangle(&self) -> Result<Rect, String> {
        Ok(self.selection.largest_rect_finite())
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
        self.selection.might_contain_xy(x as i64, y as i64)
    }

    #[wasm_bindgen(js_name = "getRanges")]
    pub fn get_ranges(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection.ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getFiniteRanges")]
    pub fn get_finite_ranges(&self) -> Result<String, String> {
        let ranges = self
            .selection
            .ranges
            .iter()
            .filter(|r| r.is_finite())
            .collect::<Vec<_>>();
        serde_json::to_string(&ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getInfiniteRanges")]
    pub fn get_infinite_ranges(&self) -> Result<String, String> {
        let ranges = self
            .selection
            .ranges
            .iter()
            .filter(|r| !r.is_finite())
            .collect::<Vec<_>>();
        serde_json::to_string(&ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "isColumnRow")]
    pub fn is_column_row(&self) -> bool {
        self.selection.is_column_row()
    }

    #[wasm_bindgen(js_name = "overlapsA1Selection")]
    pub fn overlaps_a1_selection(&self, selection: String) -> Result<bool, String> {
        let selection =
            serde_json::from_str::<A1Selection>(&selection).map_err(|e| e.to_string())?;
        Ok(self.selection.overlaps_a1_selection(&selection))
    }

    #[wasm_bindgen(js_name = "bottomRightCell")]
    pub fn bottom_right_cell(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.last_selection_end().x as u32,
            y: self.selection.last_selection_end().y as u32,
        }
    }

    #[wasm_bindgen(js_name = "isAllSelected")]
    pub fn is_all_selected(&self) -> bool {
        self.selection.is_all_selected()
    }

    #[wasm_bindgen(js_name = "isSelectedColumnsFinite")]
    pub fn is_selected_columns_finite(&self) -> bool {
        self.selection.is_selected_columns_finite()
    }

    #[wasm_bindgen(js_name = "isSelectedRowsFinite")]
    pub fn is_selected_rows_finite(&self) -> bool {
        self.selection.is_selected_rows_finite()
    }

    #[wasm_bindgen(js_name = "getSelectedColumns")]
    pub fn get_selected_columns(&self) -> Vec<u32> {
        self.selection
            .selected_columns_finite()
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRows")]
    pub fn get_selected_rows(&self) -> Vec<u32> {
        self.selection
            .selected_rows_finite()
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedColumnRanges")]
    pub fn get_selected_column_ranges(&self, from: u32, to: u32) -> Vec<u32> {
        self.selection
            .selected_column_ranges(from as i64, to as i64)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRowRanges")]
    pub fn get_selected_row_ranges(&self, from: u32, to: u32) -> Vec<u32> {
        self.selection
            .selected_row_ranges(from as i64, to as i64)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "hasOneColumnRowSelection")]
    pub fn has_one_column_row_selection(&self, one_cell: bool) -> bool {
        self.selection.has_one_column_row_selection(one_cell)
    }

    #[wasm_bindgen(js_name = "isSingleSelection")]
    pub fn is_single_selection(&self) -> bool {
        self.selection.is_single_selection()
    }

    #[wasm_bindgen(js_name = "isMultiCursor")]
    pub fn is_multi_cursor(&self) -> bool {
        self.selection.is_multi_cursor()
    }

    #[wasm_bindgen(js_name = "toA1String")]
    pub fn to_string(&self, default_sheet_id: String, sheet_map: &str) -> Result<String, String> {
        let sheet_map =
            serde_json::from_str::<SheetNameIdMap>(sheet_map).map_err(|e| e.to_string())?;
        let default_sheet_id = SheetId::from_str(&default_sheet_id).map_err(|e| e.to_string())?;
        Ok(self.selection.to_string(Some(default_sheet_id), &sheet_map))
    }
}
