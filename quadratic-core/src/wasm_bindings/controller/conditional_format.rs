//! WASM functions for Conditional Formatting

use uuid::Uuid;

use crate::grid::sheet::conditional_format::ConditionalFormatUpdate;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns the conditional formats for a sheet
    #[wasm_bindgen(js_name = "getConditionalFormats")]
    pub fn js_get_conditional_formats(&self, sheet_id: String) -> Result<JsValue, JsValue> {
        let sheet_id =
            SheetId::from_str(&sheet_id).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;
        serde_wasm_bindgen::to_value(&sheet.conditional_formats.iter().collect::<Vec<_>>())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Creates or updates a conditional format
    #[wasm_bindgen(js_name = "updateConditionalFormat")]
    pub fn js_update_conditional_format(
        &mut self,
        conditional_format: String,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let cf = serde_json::from_str::<ConditionalFormatUpdate>(&conditional_format)
                .map_err(|e| format!("Error parsing conditional format: {e}"))?;
            self.update_conditional_format(cf, cursor);
            Ok(None)
        })
    }

    /// Removes a conditional format
    #[wasm_bindgen(js_name = "removeConditionalFormat")]
    pub fn js_remove_conditional_format(
        &mut self,
        sheet_id: String,
        conditional_format_id: String,
        cursor: Option<String>,
    ) {
        if let (Ok(sheet_id), Ok(cf_id)) = (
            SheetId::from_str(&sheet_id),
            Uuid::from_str(&conditional_format_id),
        ) {
            self.remove_conditional_format(sheet_id, cf_id, cursor);
        }
    }
}
