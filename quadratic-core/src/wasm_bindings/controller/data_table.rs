use sort::DataTableSort;

use crate::a1::A1Selection;

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
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.flatten_data_table(pos.to_sheet_pos(sheet_id), cursor, is_ai);

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
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| match serde_json::from_str::<SheetRect>(&sheet_rect) {
            Ok(sheet_rect) => {
                match self.grid_to_data_table(
                    sheet_rect,
                    table_name,
                    first_row_is_header,
                    cursor,
                    is_ai,
                ) {
                    Ok(_) => Ok(None),
                    Err(e) => Err(e.to_string()),
                }
            }
            Err(e) => Err(format!("Unable to parse SheetRect: {e}")),
        })
    }

    /// Converts a DataTableKind::CodeRun to DataTableKind::Import
    #[wasm_bindgen(js_name = "codeDataTableToDataTable")]
    pub fn js_code_data_table_to_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        cursor: Option<String>,
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.code_data_table_to_data_table(pos.to_sheet_pos(sheet_id), cursor, is_ai)
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
        is_ai: bool,
    ) -> Result<(), JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        let sort = sort_js
            .map(|s| serde_json::from_str::<Vec<DataTableSort>>(&s).map_err(|e| e.to_string()))
            .transpose()?;

        self.sort_data_table(pos.to_sheet_pos(sheet_id), sort, cursor, is_ai);

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
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let pos = serde_json::from_str::<Pos>(&pos)
                .map_err(|e| format!("Unable to parse Pos: {e}"))?;
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;

            self.data_table_first_row_as_header(
                pos.to_sheet_pos(sheet_id),
                first_row_is_header,
                cursor,
                is_ai,
            );

            Ok(None)
        })
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
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let pos = serde_json::from_str::<Pos>(&pos)
                .map_err(|e| format!("Unable to parse Pos: {e}"))?;
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;

            let columns = columns_js
                .map(|c| {
                    serde_json::from_str::<Vec<JsDataTableColumnHeader>>(&c)
                        .map_err(|e| format!("Unable to parse columns: {e}"))
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
                is_ai,
            );

            Ok(None)
        })
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
        is_ai: bool,
    ) -> JsValue {
        capture_core_error(|| {
            let pos = serde_json::from_str::<Pos>(&pos)
                .map_err(|e| format!("Unable to parse Pos: {e}"))?;
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;

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
                is_ai,
            );

            Ok(None)
        })
    }

    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = "addDataTable")]
    pub fn js_add_data_table(
        &mut self,
        sheet_id: String,
        pos: String,
        name: String,
        values: JsValue,
        first_row_is_header: bool,
        cursor: Option<String>,
        is_ai: bool,
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
            is_ai,
        );

        Ok(())
    }

    /// Returns true if a cell position intersects with a data table
    #[wasm_bindgen(js_name = "cellIntersectsDataTable")]
    pub fn js_cell_intersects_data_table(
        &self,
        sheet_id: String,
        pos: String,
    ) -> Result<bool, JsValue> {
        let pos = serde_json::from_str::<Pos>(&pos).map_err(|e| e.to_string())?;
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;

        let sheet = self
            .try_sheet(sheet_id)
            .ok_or_else(|| JsValue::from_str("Sheet not found"))?;

        Ok(sheet.data_table_pos_that_contains(pos).is_some())
    }

    /// Returns true if a selection intersects with any data table
    #[wasm_bindgen(js_name = "selectionIntersectsDataTable")]
    pub fn js_selection_intersects_data_table(
        &self,
        sheet_id: String,
        selection: String,
    ) -> JsValue {
        capture_core_error(|| {
            let sheet_id = SheetId::from_str(&sheet_id)
                .map_err(|e| format!("Unable to parse SheetId: {e}"))?;
            let selection = A1Selection::parse_a1(&selection, sheet_id, self.a1_context())
                .map_err(|e| format!("Unable to parse A1Selection: {e}"))?;

            let sheet = self.try_sheet(sheet_id).ok_or("Sheet not found")?;

            // Check if any data table intersects with any of the selection rects
            let rects = selection.rects(self.a1_context());
            let has_intersection = rects.iter().any(|rect| {
                sheet
                    .data_tables_pos_intersect_rect(*rect, false)
                    .next()
                    .is_some()
            });

            Ok(Some(if has_intersection {
                JsValue::TRUE
            } else {
                JsValue::FALSE
            }))
        })
    }
}
