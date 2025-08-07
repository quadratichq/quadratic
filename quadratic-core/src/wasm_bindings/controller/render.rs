use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns cell data in a format useful for rendering. This includes only
    /// the data necessary to render raw text values.
    ///
    /// Returns a string containing a JSON array of [`JsRenderCell`].
    #[wasm_bindgen(js_name = "getRenderCells")]
    pub fn get_render_cells(&self, sheet_id: String, rect: String) -> Vec<u8> {
        let Ok(rect) = serde_json::from_str::<Rect>(&rect) else {
            return vec![];
        };
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return vec![];
        };
        sheet.send_validation_warnings_rect(rect, true);
        let output = sheet.get_render_cells(rect, self.a1_context());
        serde_json::to_vec(&output).unwrap_or_default()
    }
}
