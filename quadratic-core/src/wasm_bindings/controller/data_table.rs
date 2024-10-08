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

    /// Flattens a Data Table
    #[wasm_bindgen(js_name = "gridToDataTable")]
    pub fn js_grid_to_data_table(
        &mut self,
        sheet_id: String,
        rect: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let rect = serde_json::from_str::<Rect>(&rect).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.grid_to_data_table(rect.to_sheet_rect(sheet_id), cursor);

        Ok(())
    }
}
