use super::*;

#[derive(Serialize, Deserialize, Debug)]
#[wasm_bindgen]
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
    #[wasm_bindgen(js_name = "getColumnBounds")]
    pub fn get_column_bounds(
        &self,
        sheet_id: String,
        column: i32,
        ignore_formatting: bool,
    ) -> Option<MinMax> {
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        sheet
            .column_bounds(column as i64, ignore_formatting)
            .as_ref()
            .map(|bounds| MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            })
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
        sheet
            .columns_bounds(column_start as i64, column_end as i64, ignore_formatting)
            .as_ref()
            .map(|bounds| MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            })
    }

    // returns a row's bounds.
    #[wasm_bindgen(js_name = "getRowBounds")]
    pub fn get_row_bounds(
        &self,
        sheet_id: String,
        row: i32,
        ignore_formatting: bool,
    ) -> Option<MinMax> {
        let sheet = self.try_sheet_from_string_id(sheet_id)?;
        sheet
            .row_bounds(row as i64, ignore_formatting)
            .as_ref()
            .map(|bounds| MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            })
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
        sheet
            .rows_bounds(row_start as i64, row_end as i64, ignore_formatting)
            .as_ref()
            .map(|bounds| MinMax {
                min: bounds.0 as i32,
                max: bounds.1 as i32,
            })
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
    ) -> i32 {
        // todo: this should have Result return type and handle no sheet found (which should not happen)
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return 0;
        };
        sheet.find_next_column(column_start as i64, row as i64, reverse, with_content) as i32
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
    ) -> i32 {
        // todo: this should have Result return type and handle no sheet found (which should not happen)
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return 0;
        };
        sheet.find_next_row(row_start as i64, column as i64, reverse, with_content) as i32
    }
}
