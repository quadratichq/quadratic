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
        sheet_rect: String,
        table_name: Option<String>,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) -> JsValue {
        capture_core_error(|| match serde_json::from_str::<SheetRect>(&sheet_rect) {
            Ok(sheet_rect) => {
                match self.grid_to_data_table(sheet_rect, table_name, first_row_is_header, cursor) {
                    Ok(_) => Ok(None),
                    Err(e) => Err(e.to_string()),
                }
            }
            Err(e) => Err(e.to_string()),
        })
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

    /// Toggle applying the first row as head
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
        show_name: Option<bool>,
        show_columns: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        let columns = columns_js
            .map(|c| {
                serde_json::from_str::<Vec<JsDataTableColumnHeader>>(&c)
                    .map_err(|e| e.to_string())
                    .map(|c| c.into_iter().map(|c| c.into()).collect())
            })
            .transpose()?;

        self.data_table_meta(
            pos.to_sheet_pos(sheet_id),
            name,
            alternating_colors,
            columns,
            show_name.map(Some),
            show_columns.map(Some),
            cursor,
        );

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = "dataTableMutations")]
    pub fn js_data_table_mutations(
        &mut self,
        sheet_id: String,
        pos: String,
        select_table: bool,
        columns_to_add: Option<Vec<u32>>,
        columns_to_remove: Option<Vec<u32>>,
        rows_to_add: Option<Vec<u32>>,
        rows_to_remove: Option<Vec<u32>>,
        flatten_on_delete: Option<bool>,
        swallow_on_insert: Option<bool>,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        self.data_table_mutations(
            pos.to_sheet_pos(sheet_id),
            select_table,
            columns_to_add,
            columns_to_remove,
            rows_to_add,
            rows_to_remove,
            flatten_on_delete,
            swallow_on_insert,
            cursor,
        );

        Ok(())
    }

    #[wasm_bindgen(js_name = "addDataTable")]
    pub fn js_add_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        name: String,
        values: JsValue,
        first_row_is_header: bool,
        cursor: Option<String>,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        let values: Vec<Vec<String>> = serde_wasm_bindgen::from_value(values)
            .map_err(|_| JsValue::from_str("Invalid values"))?;

        self.add_data_table(
            pos.to_sheet_pos(sheet_id),
            name,
            values,
            first_row_is_header,
            cursor,
        );

        Ok(())
    }
}
