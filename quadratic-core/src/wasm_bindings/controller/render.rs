use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    ///
    /// Returns a string containing a JSON array of [`JsRenderCell`].
    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: String, &rect: &Rect) -> Result<String, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output = sheet.get_render_cells(rect);
        Ok(serde_json::to_string::<[JsRenderCell]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns whether there is any cells to render in this region
    #[wasm_bindgen(js_name = "hasRenderCells")]
    pub fn has_render_cells(&self, sheet_id: String, &region: &Rect) -> bool {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return false;
        };
        sheet.has_render_cells(region)
    }

    /// Returns data for rendering cell fill color as a string containing a JSON
    /// array of [`JsRenderFill`].
    #[wasm_bindgen(js_name = "getRenderFills")]
    pub fn get_render_fills(&self, sheet_id: String, region: &Rect) -> Result<String, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output = sheet.get_render_fills(*region);
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering all cell fill color as a string containing a JSON
    /// array of [`JsRenderFill`].
    #[wasm_bindgen(js_name = "getAllRenderFills")]
    pub fn get_all_render_fills(&self, sheet_id: String) -> Result<String, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output = sheet.get_all_render_fills();
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns all data for rendering HTML for a sheet
    #[wasm_bindgen(js_name = "getHtmlOutput")]
    pub fn get_html_output(&self, sheet_id: String) -> Result<String, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output = sheet.get_html_output();
        Ok(serde_json::to_string::<[JsHtmlOutput]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering code cells as a string containing a JSON array
    /// of [`JsRenderCodeCell`].
    #[wasm_bindgen(js_name = "getAllRenderCodeCells")]
    pub fn get_all_render_code_cells(&self, sheet_id: String) -> Result<String, JsValue> {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return Result::Err("Sheet not found".into());
        };
        let output = sheet.get_all_render_code_cells();
        Ok(serde_json::to_string::<[JsRenderCodeCell]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering horizontal borders as a string containing a
    /// [`JsRenderBorders`].
    #[wasm_bindgen(js_name = "getRenderBorders")]
    pub fn get_render_borders(&self, sheet_id: String) -> JsRenderBorders {
        // todo: should return Result
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return JsRenderBorders::new(vec![], vec![]);
        };
        let horizontal = sheet.get_render_horizontal_borders();
        let vertical = sheet.get_render_vertical_borders();
        JsRenderBorders::new(horizontal, vertical)
    }
}
