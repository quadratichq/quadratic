use super::*;

#[wasm_bindgen]
impl GridController {
    /// Adds an empty sheet to the grid. Returns a [`TransactionSummary`].
    #[wasm_bindgen(js_name = "addSheet")]
    pub fn js_add_sheet(
        &mut self,
        sheet_name: Option<String>,
        insert_before_sheet_name: Option<String>,
        cursor: Option<String>,
    ) {
        self.add_sheet(sheet_name, insert_before_sheet_name, cursor);
    }
    /// Gets a list of ordered sheet ids
    #[wasm_bindgen(js_name = "getSheetIds")]
    pub fn js_get_sheet_ids(&mut self) -> Result<JsValue, JsValue> {
        let sheet_ids: Vec<String> = self.sheet_ids().iter().map(|id| id.to_string()).collect();
        Ok(serde_wasm_bindgen::to_value(&sheet_ids).map_err(|e| e.to_string())?)
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
        name_of_new_sheet: Option<String>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        Ok(serde_wasm_bindgen::to_value(&self.duplicate_sheet(
            sheet_id,
            name_of_new_sheet,
            cursor,
        ))?)
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
    pub fn js_set_sheet_name(&mut self, sheet_id: String, name: String, cursor: Option<String>) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            self.set_sheet_name(sheet_id, name, cursor);
        }
    }

    #[wasm_bindgen(js_name = "setSheetColor")]
    pub fn js_set_sheet_color(
        &mut self,
        sheet_id: String,
        color: Option<String>,
        cursor: Option<String>,
    ) -> Result<JsValue, JsValue> {
        // return Ok since sheet may have been deleted between call and now
        let Ok(sheet_id) = SheetId::from_str(&sheet_id) else {
            return Ok(JsValue::UNDEFINED);
        };
        Ok(serde_wasm_bindgen::to_value(
            &self.set_sheet_color(sheet_id, color, cursor),
        )?)
    }

    #[wasm_bindgen(js_name = "setSheetColors")]
    pub fn js_set_sheet_colors(&mut self, sheet_name_to_color: JsValue, cursor: Option<String>) {
        if let Ok(sheet_name_to_color) =
            serde_wasm_bindgen::from_value::<Vec<JsSheetNameToColor>>(sheet_name_to_color)
        {
            self.set_sheet_colors(sheet_name_to_color, cursor);
        }
    }
}
