use selection::Selection;
use sheet::validations::validation::Validation;

use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "getValidation")]
    pub fn js_validation(&self, selection: String) -> String {
        let Ok(selection) = Selection::from_str(&selection) else {
            return String::new();
        };
        self.validation(selection)
            .map(|validation| serde_json::to_string(validation).unwrap_or_default())
            .unwrap_or_default()
    }

    /// Returns a stringified version of Vec<Validation>
    #[wasm_bindgen(js_name = "getValidations")]
    pub fn js_validations(&self, sheet_id: String) -> String {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            serde_json::to_string(&self.validations(sheet_id)).unwrap_or_default()
        } else {
            String::new()
        }
    }

    // creates or updates a validation and applies it to a selection
    #[wasm_bindgen(js_name = "updateValidation")]
    pub fn js_update_validation(
        &mut self,
        selection: String,  // Selection
        validation: String, // Validation
        cursor: Option<String>,
    ) {
        let validation = match serde_json::from_str::<Validation>(&validation) {
            Ok(validation) => validation,
            Err(e) => {
                dbgjs!(format!("Error parsing validation: {}", e.to_string()));
                return;
            }
        };
        match Selection::from_str(&selection) {
            Ok(selection) => self.update_validation(selection, validation, cursor),
            Err(e) => {
                dbgjs!(format!("Error parsing selection: {}", e));
            }
        };
    }
}
