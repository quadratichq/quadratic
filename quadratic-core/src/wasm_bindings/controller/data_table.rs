use super::*;

#[wasm_bindgen]
impl GridController {
    /// Flattens a Data Table
    #[wasm_bindgen(js_name = "flattenDataTable")]
    pub fn js_flatten_data_table(&mut self, sheet_id: String, pos: String, cursor: Option<String>) {
        if let Ok(pos) = serde_json::from_str::<Pos>(&pos) {
            let sheet_id = SheetId::from_str(&sheet_id).unwrap();
            self.flatten_data_table(pos.to_sheet_pos(sheet_id), cursor);
        }
    }
}
