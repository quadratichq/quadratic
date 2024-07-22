use super::*;

#[wasm_bindgen]
impl GridController {
    #[wasm_bindgen(js_name = "getCellValidation")]
    pub fn js_cell_validation(&self, x: i64, y: i64, sheet_id: String) -> String {
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return String::new();
        };
        let validation = sheet.validations.validation(Pos { x, y });
        serde_json::to_string(&validation).unwrap_or_default()
    }
}
