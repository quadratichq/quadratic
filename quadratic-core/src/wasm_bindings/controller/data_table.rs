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

        let sort = sort_js
            .map(|s| serde_json::from_str::<Vec<DataTableSort>>(&s).map_err(|e| e.to_string()))
            .transpose()?;

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
    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = "dataTableMeta")]
    pub fn js_data_table_meta(
        &mut self,
        sheet_id: String,
        pos: String,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns_js: Option<String>,
        show_header: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        let columns = columns_js
            .map(|c| {
                serde_json::from_str::<Vec<JsDataTableColumn>>(&c)
                    .map_err(|e| e.to_string())
                    .map(|c| c.into_iter().map(|c| c.into()).collect())
            })
            .transpose()?;

        self.data_table_meta(
            pos.to_sheet_pos(sheet_id),
            name,
            alternating_colors,
            columns,
            show_header,
            cursor,
        );

        Ok(())
    }
}