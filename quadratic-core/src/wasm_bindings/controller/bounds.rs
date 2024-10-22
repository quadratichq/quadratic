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

    /// finds nearest column with or without content
    #[wasm_bindgen(js_name = "findNextColumn")]
    pub fn js_find_next_column(
        &self,
        sheet_id: String,
        column_start: i32,
        row: i32,
        reverse: bool,
        with_content: bool,
    ) -> Option<i32> {
        // todo: this should have Result return type and handle no sheet found (which should not happen)
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        sheet
            .find_next_column(column_start as i64, row as i64, reverse, with_content)
            .map(|x| x as i32)
    }

    /// finds nearest row with or without content
    #[wasm_bindgen(js_name = "findNextRow")]
    pub fn js_find_next_row(
        &self,
        sheet_id: String,
        row_start: i32,
        column: i32,
        reverse: bool,
        with_content: bool,
    ) -> Option<i32> {
        // todo: this should have Result return type and handle no sheet found (which should not happen)
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        sheet
            .find_next_row(row_start as i64, column as i64, reverse, with_content)
            .map(|y| y as i32)
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
}
