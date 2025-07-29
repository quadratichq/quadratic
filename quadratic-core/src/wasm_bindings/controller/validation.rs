//! WASM functions for Validations

use uuid::Uuid;

use crate::{a1::A1Selection, grid::sheet::validations::validation::ValidationUpdate};

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Returns a list of values for a List validation
    #[wasm_bindgen(js_name = "getValidationList")]
    pub fn js_validation_list(&self, sheet_id: String, x: i64, y: i64) -> Result<JsValue, JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            Ok(serde_wasm_bindgen::to_value(
                &self.validation_list(sheet_id, x, y),
            )?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// Returns a stringified version of Vec<Validation>
    #[wasm_bindgen(js_name = "getValidations")]
    pub fn js_validations(&self, sheet_id: String) -> Result<JsValue, JsValue> {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            Ok(serde_wasm_bindgen::to_value(&self.validations(sheet_id))?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// Creates or updates a validation and applies it to a selection
    #[wasm_bindgen(js_name = "updateValidation")]
    pub fn js_update_validation(
        &mut self,
        validation: String, // Validation
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let validation = match serde_json::from_str::<ValidationUpdate>(&validation) {
                Ok(validation) => validation,
                Err(e) => {
                    dbgjs!(format!("Error parsing validation: {}", e.to_string()));
                    return Err("Error parsing validation".to_string());
                }
            };
            self.update_validation(validation, cursor);
            Ok(None)
        })
    }

    /// Removes a validation
    #[wasm_bindgen(js_name = "removeValidation")]
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

    /// Removes all validations in a sheet
    #[wasm_bindgen(js_name = "removeValidations")]
    pub fn js_remove_validations(&mut self, sheet_id: String, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.remove_validations(sheet_id, cursor);
        }
    }

    #[wasm_bindgen(js_name = "removeValidationSelection")]
    pub fn js_remove_validation_selection(
        &mut self,
        sheet_id: String,
        selection: String,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
            let selection = A1Selection::parse(&selection, sheet_id, self.a1_context(), None)?;
            self.remove_validation_selection(sheet_id, selection, cursor);
            Ok(None)
        })
    }

    /// Gets a Validation from a Position
    #[wasm_bindgen(js_name = "getValidationFromPos")]
    pub fn js_get_validation_from_pos(
        &self,
        sheet_id: String,
        pos: String,
    ) -> Result<JsValue, JsValue> {
        if let (Ok(sheet_id), Ok(pos)) = (
            SheetId::from_str(&sheet_id),
            serde_json::from_str::<Pos>(&pos),
        ) {
            Ok(serde_wasm_bindgen::to_value(
                &self.get_validation_from_pos(sheet_id, pos),
            )?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }

    /// Validates user input against any validation rules.
    #[wasm_bindgen(js_name = "validateInput")]
    pub fn js_validate_input(
        &self,
        sheet_id: String,
        pos: String,
        value: String,
    ) -> Result<JsValue, JsValue> {
        if let (Ok(sheet_id), Ok(pos)) = (
            SheetId::from_str(&sheet_id),
            serde_json::from_str::<Pos>(&pos),
        ) {
            Ok(serde_wasm_bindgen::to_value(
                &self.validate_input(sheet_id, pos, &value),
            )?)
        } else {
            Err(JsValue::from_str("Invalid sheet id"))
        }
    }
}
