use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    ///
    /// Returns a string containing a JSON array of [`JsRenderCell`].
    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: String, &region: &Rect) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_render_cells(region);
        Ok(serde_json::to_string::<[JsRenderCell]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering cell fill color as a string containing a JSON
    /// array of [`JsRenderFill`].
    #[wasm_bindgen(js_name = "getRenderFills")]
    pub fn get_render_fills(&self, sheet_id: String, region: &Rect) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_render_fills(*region);
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering all cell fill color as a string containing a JSON
    /// array of [`JsRenderFill`].
    #[wasm_bindgen(js_name = "getAllRenderFills")]
    pub fn get_all_render_fills(&self, sheet_id: String) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_all_render_fills();
        Ok(serde_json::to_string::<[JsRenderFill]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering code cells as a string containing a JSON array
    /// of [`JsRenderCodeCell`].
    #[wasm_bindgen(js_name = "getRenderCodeCells")]
    pub fn get_render_code_cells(
        &self,
        sheet_id: String,
        region: &Rect,
    ) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_render_code_cells(*region);
        Ok(serde_json::to_string::<[JsRenderCodeCell]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering code cells as a string containing a JSON array
    /// of [`JsRenderCodeCell`].
    #[wasm_bindgen(js_name = "getAllRenderCodeCells")]
    pub fn get_all_render_code_cells(&self, sheet_id: String) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_all_render_code_cells();
        Ok(serde_json::to_string::<[JsRenderCodeCell]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering horizontal borders as a string containing a
    /// JSON array of [`JsRenderBorder`].
    #[wasm_bindgen(js_name = "getRenderHorizontalBorders")]
    pub fn get_render_horizontal_borders(&self, sheet_id: String) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_render_horizontal_borders();
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }

    /// Returns data for rendering vertical borders as a string containing a
    /// JSON array of [`JsRenderBorder`].
    #[wasm_bindgen(js_name = "getRenderVerticalBorders")]
    pub fn get_render_vertical_borders(&self, sheet_id: String) -> Result<String, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let output = self.sheet(sheet_id).get_render_vertical_borders();
        Ok(serde_json::to_string::<[JsRenderBorder]>(&output).map_err(|e| e.to_string())?)
    }
}
