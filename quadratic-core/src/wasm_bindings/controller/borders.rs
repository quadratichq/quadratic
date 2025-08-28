use super::*;

#[wasm_bindgen]
impl GridController {
    /// Sets border style for the selection within a rectangle.
    #[wasm_bindgen(js_name = "setBorders")]
    pub fn js_set_borders(
        &mut self,
        selection: String,
        border_selection: String,
        style: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let selection =
                serde_json::from_str(&selection).map_err(|e| format!("Invalid selection: {e}"))?;

            let border_selection = serde_json::from_str(&border_selection)
                .map_err(|e| format!("Invalid border selection: {e}"))?;

            let style = match style {
                Some(style_str) => {
                    let style = serde_json::from_str(&style_str)
                        .map_err(|e| format!("Invalid style: {e}"))?;
                    Some(style)
                }
                None => None,
            };

            self.set_borders(selection, border_selection, style, cursor, is_ai);
            Ok(None)
        })
    }
}
