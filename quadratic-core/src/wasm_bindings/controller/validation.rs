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
    #[wasm_bindgen(js_name = "getValidations")]
    pub fn js_validations(&self, sheet_id: String) -> String {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return String::new();
        };
        serde_json::to_string(&sheet.validations.validations_all()).unwrap_or_default()
    }

    /// Creates a new validation
    #[wasm_bindgen(js_name = "createValidation")]
    pub fn js_create_validation(
        &mut self,
        sheet_id: String,
        validation_create: String, // ValidationCreate
        selection: String,         // Selection
        cursor: Option<String>,
    ) {
        self.create_validation(sheet_id, selection, validation_create, cursor);
    }

    // updates an existing validation
    #[wasm_bindgen(js_name = "updateValidation")]
    pub fn js_update_validation(
        &mut self,
        sheet_id: String,
        validation: String, // Validation
        selection: String,  // Selection
        cursor: Option<String>,
    ) {
        self.update_validation(sheet_id, validation, selection, cursor);
    }

    // deletes a validation
    #[wasm_bindgen(js_name = "deleteValidation")]
    pub fn js_delete_validation(&mut self, selection: String, cursor: Option<String>) {
        self.delete_validation(selection, cursor);
    }
}
