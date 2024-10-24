use selection::Selection;
use sort::DataTableSort;

use super::*;

#[wasm_bindgen]
impl GridController {
    /// Flattens a Data Table
    #[wasm_bindgen(js_name = "flattenDataTable")]
    pub fn js_flatten_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.flatten_data_table(pos.to_sheet_pos(sheet_id), cursor);

        Ok(())
    }

    /// Converts a selection on the grid to a Data Table
    #[wasm_bindgen(js_name = "gridToDataTable")]
    pub fn js_grid_to_data_table(
        &mut self,
        selection: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let selection = Selection::from_str(&selection).map_err(|_| "Invalid selection")?;
        let sheet_rect = selection.rects.unwrap()[0].to_sheet_rect(selection.sheet_id);
        self.grid_to_data_table(sheet_rect, cursor);

        Ok(())
    }

    /// Converts a DataTableKind::CodeRun to DataTableKind::Import
    #[wasm_bindgen(js_name = "codeDataTableToDataTable")]
    pub fn js_code_data_table_to_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.code_data_table_to_data_table(pos.to_sheet_pos(sheet_id), cursor)
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Sort a Data Table
    #[wasm_bindgen(js_name = "sortDataTable")]
    pub fn js_sort_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        sort_js: Option<String>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        let mut sort = None;

        if let Some(sort_js) = sort_js {
            sort = Some(
                serde_json::from_str::<Vec<DataTableSort>>(&sort_js).map_err(|e| e.to_string())?,
            );
        }

        self.sort_data_table(pos.to_sheet_pos(sheet_id), sort, cursor);

        Ok(())
    }

    /// Toggle appling the first row as head
    #[wasm_bindgen(js_name = "dataTableFirstRowAsHeader")]
    pub fn js_data_table_first_row_as_header(
        &mut self,
        sheet_id: String,
        pos: String,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.data_table_first_row_as_header(
            pos.to_sheet_pos(sheet_id),
            first_row_is_header,
            cursor,
        );

        Ok(())
    }
    /// Update a Data Table's name
    #[wasm_bindgen(js_name = "updateDataTableName")]
    pub fn js_update_data_table_name(
        &mut self,
        sheet_id: String,
        pos: String,
        name: String,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        self.update_data_table_name(pos.to_sheet_pos(sheet_id), name, cursor);

        Ok(())
    }
}
