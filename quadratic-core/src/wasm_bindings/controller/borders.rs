use super::*;

#[wasm_bindgen]
impl GridController {
    /// Sets border style for the selection within a rectangle.
    ///
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setRegionBorders")]
    pub fn js_set_region_borders(
        &mut self,
        sheet_id: String,
        rect: Rect,
        selection: BorderSelection, // TODO: Vec
        style: Option<BorderStyle>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.set_borders(
            rect.to_sheet_rect(sheet_id),
            vec![selection],
            style,
            cursor,
        ))?)
    }
}
