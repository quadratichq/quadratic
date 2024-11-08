use sheet::jump_cursor::JumpDirection;

use super::*;

#[derive(Serialize, Deserialize, Debug)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
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
    ) -> Option<String> {
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        if let Some(bounds) =
            sheet.columns_bounds(column_start as i64, column_end as i64, ignore_formatting)
        {
            let min_max = MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            };
            serde_json::to_string(&min_max).ok()
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
    ) -> Option<String> {
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        if let Some(bounds) = sheet.rows_bounds(row_start as i64, row_end as i64, ignore_formatting)
        {
            let min_max = MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            };
            serde_json::to_string(&min_max).ok()
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
    ) -> Result<String, JsValue> {
        let sheet = self
            .try_sheet_from_string_id(sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;
        let pos: Pos = serde_json::from_str(&pos)
            .map_err(|e| JsValue::from_str(&format!("Invalid current position: {}", e)))?;
        let direction: JumpDirection = serde_json::from_str(&direction)
            .map_err(|e| JsValue::from_str(&format!("Invalid direction: {}", e)))?;
        let next = sheet.jump_cursor(pos, direction);
        serde_json::to_string(&next)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize next position: {}", e)))
    }
}
