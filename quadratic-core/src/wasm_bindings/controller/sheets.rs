use super::*;

#[wasm_bindgen]
impl GridController {
    /// Adds an empty sheet to the grid. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "addSheet")]
    pub fn js_add_sheet(&mut self, cursor: Option<String>) -> Result<JsValue, JsValue> {
        Ok(serde_wasm_bindgen::to_value(&self.add_sheet(cursor))?)
    }
    /// Gets a list of ordered sheet ids
    #[wasm_bindgen(js_name = "getSheetIds")]
    pub fn js_get_sheet_ids(&mut self) -> Result<String, JsValue> {
        let sheet_ids: Vec<String> = self.sheet_ids().iter().map(|id| id.to_string()).collect();
        Ok(serde_json::to_string(&sheet_ids).map_err(|e| e.to_string())?)
    }
    /// Deletes a sheet from the the grid. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "deleteSheet")]
    pub fn js_delete_sheet(
        &mut self,
        sheet_id: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id);
        Ok(serde_wasm_bindgen::to_value(
            &self.delete_sheet(sheet_id.unwrap(), cursor),
        )?)
    }
    /// Moves a sheet to before another sheet, or to the end of the list.
    /// Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "moveSheet")]
    pub fn js_move_sheet(
        &mut self,
        sheet_id: String,
        to_before: Option<String>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        let to_before = to_before.map(|to_before| SheetId::from_str(&to_before).unwrap());
        Ok(serde_wasm_bindgen::to_value(
            &self.move_sheet(sheet_id, to_before, cursor),
        )?)
    }
    /// Makes a copy of a sheet. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "duplicateSheet")]
    pub fn js_duplicate_sheet(
        &mut self,
        sheet_id: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.duplicate_sheet(sheet_id, cursor),
        )?)
    }

    /// Returns the order string for a sheet.
    #[wasm_bindgen(js_name = "getSheetOrder")]
    pub fn js_sheet_order(&self, sheet_id: String) -> String {
        // todo: should return a Result
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
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
    /// Returns the index of the sheet with the given ID.
    #[wasm_bindgen(js_name = "sheetIndexToId")]
    pub fn js_sheet_index_to_id(&self, index: usize) -> Result<String, JsValue> {
        let sheet_id = self.grid().sheet_index_to_id(index);
        match sheet_id {
            Some(sheet_id) => Ok(sheet_id.to_string()),
            None => Err(JsValue::UNDEFINED),
        }
    }

    #[wasm_bindgen(js_name = "getSheetName")]
    pub fn js_sheet_name(&self, sheet_id: String) -> String {
        // todo: should return a Result
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return "Sheet".into();
        };
        sheet.name.clone()
    }

    #[wasm_bindgen(js_name = "getSheetColor")]
    pub fn js_sheet_color(&self, sheet_id: String) -> String {
        // todo: should return a Result
        let Some(sheet) = self.try_sheet_from_string_id(sheet_id) else {
            return "".to_string();
        };
        sheet.color.clone().unwrap_or_default()
    }

    /// Returns a code cell as a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setSheetName")]
    pub fn js_set_sheet_name(
        &mut self,
        sheet_id: String,
        name: String,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_sheet_name(sheet_id, name, cursor),
        )?)
    }

    /// Returns a code cell as a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "setSheetColor")]
    pub fn js_set_sheet_color(
        &mut self,
        sheet_id: String,
        color: Option<String>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(
            &self.set_sheet_color(sheet_id, color, cursor),
        )?)
    }
}
