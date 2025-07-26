use super::*;

#[wasm_bindgen]
impl GridController {
    /// Gets a list of ordered sheet ids
    #[wasm_bindgen(js_name = "getSheetIds")]
    pub fn js_get_sheet_ids(&mut self) -> Result<JsValue, JsValue> {
        let sheet_ids: Vec<String> = self.sheet_ids().iter().map(|id| id.to_string()).collect();
        Ok(serde_wasm_bindgen::to_value(&sheet_ids).map_err(|e| e.to_string())?)
    }

    /// Adds an empty sheet to the grid. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "addSheet")]
    pub fn js_add_sheet(
        &mut self,
        sheet_name: Option<String>,
        insert_before_sheet_name: Option<String>,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            self.add_sheet(sheet_name, insert_before_sheet_name, cursor);
            Ok(None)
        })
    }

    /// Makes a copy of a sheet. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "duplicateSheet")]
    pub fn js_duplicate_sheet(
        &mut self,
        sheet_id: String,
        name_of_new_sheet: Option<String>,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            self.duplicate_sheet(sheet_id, name_of_new_sheet, cursor);
            Ok(None)
        })
    }

    /// Deletes a sheet from the the grid. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "deleteSheet")]
    pub fn js_delete_sheet(&mut self, sheet_id: String, cursor: Option<String>) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            self.delete_sheet(sheet_id, cursor);
            Ok(None)
        })
    }

    /// Moves a sheet to before another sheet, or to the end of the list.
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "moveSheet")]
    pub fn js_move_sheet(
        &mut self,
        sheet_id: String,
        to_before: Option<String>,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            let to_before = match to_before {
                Some(to_before) => Some(
                    SheetId::from_str(&to_before)
                        .map_err(|e| format!("Invalid to before sheet ID: {e}"))?,
                ),
                None => None,
            };
            self.move_sheet(sheet_id, to_before, cursor);
            Ok(None)
        })
    }

    /// Returns the order string for a sheet.
    #[wasm_bindgen(js_name = "getSheetOrder")]
    pub fn js_sheet_order(&self, sheet_id: String) -> String {
        // todo: should return a Result
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return "a0".to_string();
        };
        sheet.order.clone()
    }

    /// Returns the ID of the sheet at the given index.
    #[wasm_bindgen(js_name = "sheetIdToIndex")]
    pub fn js_sheet_id_to_index(&self, id: String) -> Option<usize> {
        let sheet_id = SheetId::from_str(&id).unwrap();
        self.grid().sheet_id_to_index(sheet_id)
    }

    #[wasm_bindgen(js_name = "getSheetName")]
    pub fn js_sheet_name(&self, sheet_id: String) -> String {
        // todo: should return a Result
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return "Sheet".into();
        };
        sheet.name.clone()
    }

    #[wasm_bindgen(js_name = "getSheetColor")]
    pub fn js_sheet_color(&self, sheet_id: String) -> String {
        // todo: should return a Result
        let Some(sheet) = self.try_sheet_from_string_id(&sheet_id) else {
            return "".to_string();
        };
        sheet.color.clone().unwrap_or_default()
    }

    #[wasm_bindgen(js_name = "setSheetName")]
    pub fn js_set_sheet_name(
        &mut self,
        sheet_id: String,
        name: String,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            self.set_sheet_name(sheet_id, name, cursor);
            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "setSheetColor")]
    pub fn js_set_sheet_color(
        &mut self,
        sheet_id: String,
        color: Option<String>,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id =
                SheetId::from_str(&sheet_id).map_err(|e| format!("Invalid sheet ID: {e}"))?;
            self.set_sheet_color(sheet_id, color, cursor);
            Ok(None)
        })
    }

    #[wasm_bindgen(js_name = "setSheetsColor")]
    pub fn js_set_sheets_color(
        &mut self,
        sheet_names_to_color: JsValue,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_names_to_color =
                serde_wasm_bindgen::from_value::<Vec<JsSheetNameToColor>>(sheet_names_to_color)
                    .map_err(|e| format!("Invalid sheet names to color: {e}"))?;
            self.set_sheets_color(sheet_names_to_color, cursor);
            Ok(None)
        })
    }
}
