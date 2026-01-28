//! WASM functions for Conditional Formatting

use uuid::Uuid;

use crate::grid::sheet::conditional_format::{ConditionalFormatRule, ConditionalFormatUpdate};

use super::*;

/// Converts a ConditionalFormatRule to a formula string.
/// Takes a JSON-serialized ConditionalFormatRule and an anchor cell reference (e.g., "A1", "B2").
/// Returns the formula string (e.g., "ISBLANK(B2)", "B2>5").
#[wasm_bindgen(js_name = "conditionalFormatRuleToFormula")]
pub fn conditional_format_rule_to_formula(rule_json: String, anchor: String) -> Result<String, JsValue> {
    let rule: ConditionalFormatRule = serde_json::from_str(&rule_json)
        .map_err(|e| JsValue::from_str(&format!("Error parsing rule: {e}")))?;
    Ok(rule.to_formula_string(&anchor))
}

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

    /// Sets a preview conditional format for live preview while editing.
    /// This is transient and not persisted. Triggers a re-render of affected cells.
    #[wasm_bindgen(js_name = "previewConditionalFormat")]
    pub fn js_preview_conditional_format(
        &mut self,
        conditional_format: String,
    ) -> JsValue {
        capture_core_error(|| {
            let cf_update = serde_json::from_str::<ConditionalFormatUpdate>(&conditional_format)
                .map_err(|e| format!("Error parsing conditional format: {e}"))?;
            self.set_preview_conditional_format(cf_update)?;
            Ok(None)
        })
    }

    /// Clears the preview conditional format and triggers a re-render.
    #[wasm_bindgen(js_name = "clearPreviewConditionalFormat")]
    pub fn js_clear_preview_conditional_format(&mut self, sheet_id: String) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.clear_preview_conditional_format(sheet_id);
        }
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

    /// Batch update conditional formats - creates, updates, or deletes multiple
    /// conditional formats in a single transaction. Used by AI tools.
    #[wasm_bindgen(js_name = "batchUpdateConditionalFormats")]
    pub fn js_batch_update_conditional_formats(
        &mut self,
        sheet_id: String,
        updates: String,
        delete_ids: String,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet_id: {e}"))?;

            let updates: Vec<ConditionalFormatUpdate> = serde_json::from_str(&updates)
                .map_err(|e| format!("Error parsing updates: {e}"))?;

            let delete_ids: Vec<Uuid> = serde_json::from_str(&delete_ids)
                .map_err(|e| format!("Error parsing delete_ids: {e}"))?;

            match self.batch_update_conditional_formats(sheet_id, updates, delete_ids, cursor) {
                Ok(()) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }
}
