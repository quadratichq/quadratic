use selection::Selection;

use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "getValidation")]
    pub fn js_validation(&self, selection: String) -> String {
        let Ok(selection) = Selection::from_str(&selection) else {
            return String::new();
        };
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return String::new();
        };
        let validation = sheet.validations.validation(selection);
        serde_json::to_string(&validation).unwrap_or_default()
    }

    /// Returns a stringified version of Vec<Validation>
    #[wasm_bindgen(js_name = "getValidation")]
    pub fn js_validations(&self, sheet_id: String) -> String {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return String::new();
        };
        serde_json::to_string(&sheet.validations.validations_all()).unwrap_or_default()
    }
}
