use selection::Selection;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Flattens a Data Table
    #[wasm_bindgen(js_name = "flattenDataTable")]
    pub fn js_flatten_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.flatten_data_table(pos.to_sheet_pos(sheet_id), cursor);

        Ok(())
    }

    /// Converts a selection on the grid to a Data Table
    #[wasm_bindgen(js_name = "gridToDataTable")]
    pub fn js_grid_to_data_table(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let sheet_rect = selection.rects.unwrap()[0].to_sheet_rect(selection.sheet_id);
        self.grid_to_data_table(sheet_rect, cursor);

        Ok(())
    }

    /// Sort a Data Table
    #[wasm_bindgen(js_name = "sortDataTable")]
    pub fn js_sort_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        column_index: u32,
        sort_order: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.sort_data_table(pos.to_sheet_pos(sheet_id), column_index, sort_order, cursor);

        Ok(())
    }

    /// Toggle applin the first row as head
    #[wasm_bindgen(js_name = "dataTablefirstRowAsHeader")]
    pub fn js_data_table_first_row_as_header(
        &mut self,
        sheet_id: String,
        pos: String,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.data_table_first_row_as_header(
            pos.to_sheet_pos(sheet_id),
            first_row_is_header,
            cursor,
        );

        Ok(())
    }
}
