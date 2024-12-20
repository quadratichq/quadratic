use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    ///
    /// Returns a string containing a JSON array of [`JsRenderCell`].
    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: String, rect: String) -> Result<JsValue, JsValue> {
        let rect = serde_json::from_str::<Rect>(&rect).map_err(|e| e.to_string())?;
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        sheet.send_validation_warnings_rect(rect);
        let output = sheet.get_render_cells(rect);
        Ok(serde_wasm_bindgen::to_value(&output).map_err(|e| e.to_string())?)
    }

    /// Returns whether there is any cells to render in this region
    #[wasm_bindgen(js_name = "hasRenderCells")]
    pub fn has_render_cells(&self, sheet_id: String, rect: String) -> bool {
        if let Ok(rect) = serde_json::from_str::<Rect>(&rect) {
            let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
                return false;
            };
            sheet.has_render_cells(rect)
        } else {
            false
        }
    }
}
