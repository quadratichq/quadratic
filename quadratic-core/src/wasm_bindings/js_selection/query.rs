use wasm_bindgen::prelude::*;

use crate::{
    a1::{CellRefRange, UNBOUNDED},
    grid::sheet::data_tables::cache::SheetDataTablesCache,
};

use super::*;

const MAX_RANGE_TO_DISPLAY: i64 = 100_000_000;

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(js_name = "toCursorA1")]
    pub fn to_cursor_a1(&self) -> Result<String, String> {
        Ok(self.selection.to_cursor_a1())
    }

    #[wasm_bindgen(js_name = "getSheetId")]
    pub fn sheet_id(&self) -> String {
        self.selection.sheet_id.to_string()
    }

    #[wasm_bindgen(js_name = "getSheetName")]
    pub fn sheet_name(&self, context: &JsA1Context) -> String {
        context
            .get_context()
            .try_sheet_id(self.selection.sheet_id)
            .map(|name| name.to_string())
            .unwrap_or_default()
    }

    /// Get A1Selection as a JsValue.
    #[wasm_bindgen]
    pub fn selection(&self) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(&self.selection).map_err(|e| e.to_string())
    }

    /// Returns the cursor position (as a JsCoordinate)
    #[wasm_bindgen(js_name = "getCursor")]
    pub fn cursor(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.cursor.x as u32,
            y: self.selection.cursor.y as u32,
        }
    }

    #[wasm_bindgen(js_name = "getBottomRightCell")]
    pub fn get_bottom_right_cell(&self) -> JsCoordinate {
        self.selection.bottom_right_cell().into()
    }

    #[wasm_bindgen(js_name = "getLargestRectangle")]
    pub fn get_largest_rectangle(&self, context: &JsA1Context) -> Result<Rect, String> {
        Ok(self.selection.largest_rect_finite(context.get_context()))
    }

    #[wasm_bindgen(js_name = "getLargestUnboundedRectangle")]
    pub fn get_largest_unbounded_rectangle(&self, context: &JsA1Context) -> Result<Rect, String> {
        Ok(self.selection.largest_rect_unbounded(context.get_context()))
    }

    #[wasm_bindgen(js_name = "getSingleRectangle")]
    pub fn get_single_rectangle(&self, context: &JsA1Context) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect(context.get_context()))
    }

    #[wasm_bindgen(js_name = "getSingleRectangleOrCursor")]
    pub fn get_single_rectangle_or_cursor(
        &self,
        context: &JsA1Context,
    ) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect_or_cursor(context.get_context()))
    }

    #[wasm_bindgen(js_name = "getContiguousColumns")]
    pub fn get_contiguous_columns(&self) -> Option<Vec<u32>> {
        self.selection.contiguous_columns()
    }

    #[wasm_bindgen(js_name = "getContiguousRows")]
    pub fn get_contiguous_rows(&self) -> Option<Vec<u32>> {
        self.selection.contiguous_rows()
    }

    #[wasm_bindgen(js_name = "contains")]
    pub fn contains(&self, x: u32, y: u32, context: &JsA1Context) -> bool {
        self.selection
            .might_contain_xy(x as i64, y as i64, context.get_context())
    }

    #[wasm_bindgen(js_name = "getRanges")]
    pub fn get_ranges(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection.ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getSheetRefRangeBounds")]
    pub fn sheet_ref_range_bounds(&self) -> Result<JsValue, String> {
        let ranges = self
            .selection
            .ranges
            .iter()
            .filter(|r| r.is_finite())
            .filter_map(|range| match range {
                CellRefRange::Sheet { range } => Some(*range),
                CellRefRange::Table { .. } => None,
            })
            .collect::<Vec<_>>();
        serde_wasm_bindgen::to_value(&ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getFiniteRefRangeBounds")]
    pub fn finite_ref_range_bounds(
        &self,
        context: &JsA1Context,
        merge_cells: &crate::wasm_bindings::merge_cells::JsMergeCells,
    ) -> Result<JsValue, String> {
        let ranges = self
            .selection
            .finite_ref_range_bounds(context.get_context(), Some(merge_cells.get_merge_cells()));
        serde_wasm_bindgen::to_value(&ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "containsMergedCells")]
    pub fn contains_merged_cells(
        &self,
        context: &JsA1Context,
        merge_cells: &crate::wasm_bindings::merge_cells::JsMergeCells,
    ) -> bool {
        self.selection
            .contains_merged_cells(context.get_context(), Some(merge_cells.get_merge_cells()))
    }

    #[wasm_bindgen(js_name = "getInfiniteRefRangeBounds")]
    pub fn get_infinite_ref_range_bounds(&self) -> Result<JsValue, String> {
        let ranges = self
            .selection
            .ranges
            .iter()
            .filter_map(|r| {
                if r.is_finite() {
                    None
                } else {
                    match r {
                        CellRefRange::Sheet { range } => Some(*range),

                        // tables cannot have infinite bounds
                        CellRefRange::Table { .. } => None,
                    }
                }
            })
            .collect::<Vec<_>>();
        serde_wasm_bindgen::to_value(&ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "isColumnRow")]
    pub fn is_column_row(&self) -> bool {
        self.selection.is_column_row()
    }

    #[wasm_bindgen(js_name = "overlapsA1Selection")]
    pub fn overlaps_a1_selection(
        &self,
        selection: &str,
        context: &JsA1Context,
    ) -> Result<bool, String> {
        let selection =
            serde_json::from_str::<A1Selection>(selection).map_err(|e| e.to_string())?;
        Ok(self
            .selection
            .overlaps_a1_selection(&selection, context.get_context()))
    }

    #[wasm_bindgen(js_name = "selectionEnd")]
    pub fn js_selection_end(&self, context: &JsA1Context) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.last_selection_end(context.get_context()).x as u32,
            y: self.selection.last_selection_end(context.get_context()).y as u32,
        }
    }

    #[wasm_bindgen(js_name = "isAllSelected")]
    pub fn is_all_selected(&self) -> bool {
        self.selection.is_all_selected()
    }

    #[wasm_bindgen(js_name = "isEntireColumnSelected")]
    pub fn is_entire_column_selected(&self, column: u32) -> bool {
        self.selection.is_entire_column_selected(column as i64)
    }

    #[wasm_bindgen(js_name = "isEntireRowSelected")]
    pub fn is_entire_row_selected(&self, row: u32) -> bool {
        self.selection.is_entire_row_selected(row as i64)
    }

    #[wasm_bindgen(js_name = "isSelectedColumnsFinite")]
    pub fn is_selected_columns_finite(&self, context: &JsA1Context) -> bool {
        self.selection
            .is_selected_columns_finite(context.get_context())
    }

    #[wasm_bindgen(js_name = "isSelectedRowsFinite")]
    pub fn is_selected_rows_finite(&self, context: &JsA1Context) -> bool {
        self.selection
            .is_selected_rows_finite(context.get_context())
    }

    #[wasm_bindgen(js_name = "getColumnsWithSelectedCells")]
    pub fn get_selected_columns_finite(&self, context: &JsA1Context) -> Vec<u32> {
        self.selection
            .columns_with_selected_cells(context.get_context())
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getRowsWithSelectedCells")]
    pub fn get_selected_rows_finite(&self, context: &JsA1Context) -> Vec<u32> {
        self.selection
            .rows_with_selected_cells(context.get_context())
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedColumnRanges")]
    pub fn get_selected_column_ranges(
        &self,
        from: u32,
        to: u32,
        context: &JsA1Context,
    ) -> Vec<u32> {
        self.selection
            .selected_column_ranges(from as i64, to as i64, context.get_context())
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRowRanges")]
    pub fn get_selected_row_ranges(&self, from: u32, to: u32, context: &JsA1Context) -> Vec<u32> {
        self.selection
            .selected_row_ranges(from as i64, to as i64, context.get_context())
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "canInsertColumnRow")]
    pub fn can_insert_column_row(&self) -> bool {
        self.selection.can_insert_column_row()
    }

    #[wasm_bindgen(js_name = "hasOneColumnRowSelection")]
    pub fn has_one_column_row_selection(&self, one_cell: bool, context: &JsA1Context) -> bool {
        self.selection
            .has_one_column_row_selection(one_cell, context.get_context())
    }

    #[wasm_bindgen(js_name = "isSingleSelection")]
    pub fn is_single_selection(&self, context: &JsA1Context) -> bool {
        self.selection.is_single_selection(context.get_context())
    }

    #[wasm_bindgen(js_name = "isMultiCursor")]
    pub fn is_multi_cursor(&self, context: &JsA1Context) -> bool {
        self.selection.is_multi_cursor(context.get_context())
    }

    #[wasm_bindgen(js_name = "toA1String")]
    pub fn to_string(
        &self,
        default_sheet_id: Option<String>,
        context: &JsA1Context,
    ) -> Result<String, String> {
        let default_sheet_id = default_sheet_id
            .map(|default_sheet_id| SheetId::from_str(&default_sheet_id).map_err(|e| e.to_string()))
            .transpose()?;
        Ok(self
            .selection
            .to_string(default_sheet_id, context.get_context()))
    }

    #[wasm_bindgen(js_name = "cursorIsOnHtmlImage")]
    pub fn cursor_is_on_html_image(&self, context: &JsA1Context) -> bool {
        self.selection
            .cursor_is_on_html_image(context.get_context())
    }

    #[wasm_bindgen(js_name = "getSelectedTableNames")]
    pub fn get_selected_table_names(
        &self,
        sheet_id: String,
        data_table_cache: &SheetDataTablesCache,
        context: &JsA1Context,
    ) -> Result<JsValue, String> {
        let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        serde_wasm_bindgen::to_value(&self.selection.selected_table_names(
            sheet_id,
            data_table_cache,
            context.get_context(),
        ))
        .map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getTableColumnSelection")]
    pub fn get_table_column_selection(&self, table_name: &str, context: &JsA1Context) -> JsValue {
        self.selection
            .table_column_selection(table_name, context.get_context())
            .map_or(JsValue::UNDEFINED, |cols| {
                serde_wasm_bindgen::to_value(&cols).unwrap_or(JsValue::UNDEFINED)
            })
    }

    #[wasm_bindgen(js_name = "getTablesWithColumnSelection")]
    pub fn get_tables_with_column_selection(&self) -> Vec<String> {
        self.selection
            .tables_with_column_selection()
            .iter()
            .map(|t| t.to_string())
            .collect()
    }

    #[wasm_bindgen(js_name = "getSingleFullTableSelectionName")]
    pub fn get_single_full_table_selection_name(&self) -> Option<String> {
        self.selection.get_single_full_table_selection_name()
    }

    #[wasm_bindgen(js_name = "isTableColumnSelected")]
    pub fn is_table_column_selected(
        &self,
        table_name: &str,
        column: u32,
        context: &JsA1Context,
    ) -> bool {
        self.selection
            .is_table_column_selected(table_name, column as i64, context.get_context())
    }

    #[wasm_bindgen(js_name = "getSelectedTableColumnsCount")]
    pub fn get_selected_table_columns(&self, context: &JsA1Context) -> u32 {
        self.selection.selected_table_columns(context.get_context()) as u32
    }

    #[wasm_bindgen(js_name = "getSelectedColumns")]
    pub fn get_selected_columns(&self) -> Vec<u32> {
        self.selection
            .selected_columns()
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRows")]
    pub fn get_selected_rows(&self) -> Vec<u32> {
        self.selection
            .selected_rows()
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "outOfRange")]
    pub fn out_of_range(&self) -> bool {
        self.selection.ranges.iter().any(|range| {
            if let CellRefRange::Sheet { range } = range {
                (range.start.col() != UNBOUNDED && range.start.col() > MAX_RANGE_TO_DISPLAY)
                    || (range.end.col() != UNBOUNDED && range.end.col() > MAX_RANGE_TO_DISPLAY)
                    || (range.start.row() != UNBOUNDED && range.start.row() > MAX_RANGE_TO_DISPLAY)
                    || (range.end.row() != UNBOUNDED && range.end.row() > MAX_RANGE_TO_DISPLAY)
            } else {
                false
            }
        })
    }

    #[wasm_bindgen(js_name = "is1dRange")]
    pub fn is_1d_range(&self, context: &JsA1Context) -> bool {
        self.selection.is_1d_range(context.get_context())
    }

    /// Returns the first cell position of the first range in the selection.
    /// This is different from the cursor position, which may be elsewhere.
    /// For table column selections, this returns the first data cell of that column.
    #[wasm_bindgen(js_name = "getFirstRangeStart")]
    pub fn get_first_range_start(&self, context: &JsA1Context) -> Option<JsCoordinate> {
        use crate::grid::sheet::conditional_format::ConditionalFormatRule;

        ConditionalFormatRule::get_first_cell_from_selection(&self.selection, context.get_context())
            .map(|pos| JsCoordinate {
                x: pos.x as u32,
                y: pos.y as u32,
            })
    }
}
