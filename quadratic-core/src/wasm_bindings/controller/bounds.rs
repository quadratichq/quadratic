use sheet::jump_cursor::JumpDirection;
use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::*;

#[derive(Serialize, Deserialize, Debug, TS)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct MinMax {
    pub min: i32,
    pub max: i32,
}

#[wasm_bindgen]
impl GridController {
    /// Returns a sheet's bounds.
    #[wasm_bindgen(js_name = "getGridBounds")]
    pub fn get_grid_bounds(
        &self,
        sheet_id: String,
        ignore_formatting: bool,
    ) -> Result<JsValue, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Err(JsValue::from_str("Sheet not found"));
        };
        Ok(serde_wasm_bindgen::to_value(
            &sheet.bounds(ignore_formatting),
        )?)
    }

    // returns a column's bounds.
    #[wasm_bindgen(js_name = "getColumnsBounds")]
    pub fn get_columns_bounds(
        &self,
        sheet_id: String,
        column_start: i32,
        column_end: i32,
        ignore_formatting: bool,
    ) -> Option<MinMax> {
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        if let Some(bounds) =
            sheet.columns_bounds(column_start as i64, column_end as i64, ignore_formatting)
        {
            let min_max = MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            };
            Some(min_max)
        } else {
            None
        }
    }

    // returns a column's bounds.
    #[wasm_bindgen(js_name = "getRowsBounds")]
    pub fn get_rows_bounds(
        &self,
        sheet_id: String,
        row_start: i32,
        row_end: i32,
        ignore_formatting: bool,
    ) -> Option<MinMax> {
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        if let Some(bounds) = sheet.rows_bounds(row_start as i64, row_end as i64, ignore_formatting)
        {
            let min_max = MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            };
            Some(min_max)
        } else {
            None
        }
    }

    #[wasm_bindgen(js_name = "jumpCursor")]
    pub fn js_jump_cursor(
        &self,
        sheet_id: String,
        pos: String,
        direction: String,
    ) -> Result<Pos, JsValue> {
        let sheet = self
            .try_sheet_from_string_id(sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;
        let pos: Pos = serde_json::from_str(&pos)
            .map_err(|e| JsValue::from_str(&format!("Invalid current position: {}", e)))?;
        let direction: JumpDirection = serde_json::from_str(&direction)
            .map_err(|e| JsValue::from_str(&format!("Invalid direction: {}", e)))?;
        let next = sheet.jump_cursor(pos, direction);

        Ok(next)
    }

    /// finds nearest column that can be used to place a rect
    #[wasm_bindgen(js_name = "findNextColumnForRect")]
    pub fn js_find_next_column_for_rect(
        &self,
        sheet_id: String,
        column_start: i32,
        row: i32,
        width: i32,
        height: i32,
        reverse: bool,
    ) -> i32 {
        if let Some(sheet) = self.try_sheet_from_string_id(sheet_id) {
            let rect =
                Rect::from_numbers(column_start as i64, row as i64, width as i64, height as i64);
            sheet.find_next_column_for_rect(column_start as i64, row as i64, reverse, rect) as i32
        } else {
            column_start
        }
    }

    /// finds nearest row that can be used to place a rect
    #[wasm_bindgen(js_name = "findNextRowForRect")]
    pub fn js_find_next_row_for_rect(
        &self,
        sheet_id: String,
        column: i32,
        row_start: i32,
        width: i32,
        height: i32,
        reverse: bool,
    ) -> i32 {
        if let Some(sheet) = self.try_sheet_from_string_id(sheet_id) {
            let rect =
                Rect::from_numbers(column as i64, row_start as i64, width as i64, height as i64);
            sheet.find_next_row_for_rect(row_start as i64, column as i64, reverse, rect) as i32
        } else {
            row_start
        }
    }

    #[wasm_bindgen(js_name = "finiteRectFromSelection")]
    pub fn js_finite_rect_from_selection(&self, selection: String) -> Result<JsValue, JsValue> {
        let selection =
            serde_json::from_str::<A1Selection>(&selection).map_err(|e| e.to_string())?;
        if selection.ranges.is_empty() || selection.ranges.len() > 1 {
            return Err(JsValue::from_str("Expected a single range in selection"));
        }
        let sheet = self
            .try_sheet(selection.sheet_id)
            .ok_or(JsValue::UNDEFINED)?;
        let selection = sheet.finitize_selection(&selection);
        serde_wasm_bindgen::to_value(&selection.ranges[0].to_rect()).map_err(|_| JsValue::UNDEFINED)
    }
}
