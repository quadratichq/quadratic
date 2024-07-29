use selection::Selection;
use sheet::validations::validation::Validation;
use uuid::Uuid;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns a stringified version of Validation for a given selection
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
        self.update_validation(validation, cursor);
    }

    // removes a validation
    pub fn js_remove_validation(
        &mut self,
        sheet_id: String,
        validation_id: String,
        cursor: Option<String>,
    ) {
        if let (Ok(sheet_id), Ok(validation_id)) =
            (SheetId::from_str(&sheet_id), Uuid::from_str(&validation_id))
        {
            self.remove_validation(sheet_id, validation_id, cursor);
        }
    }
}
