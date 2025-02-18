use wasm_bindgen::prelude::*;

use crate::a1::CellRefRange;

use super::*;

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
    pub fn get_largest_rectangle(&self) -> Result<Rect, String> {
        Ok(self.selection.largest_rect_finite(&self.context))
    }

    #[wasm_bindgen(js_name = "getSingleRectangle")]
    pub fn get_single_rectangle(&self) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect(&self.context))
    }

    #[wasm_bindgen(js_name = "getSingleRectangleOrCursor")]
    pub fn get_single_rectangle_or_cursor(&self) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect_or_cursor(&self.context))
    }

    #[wasm_bindgen(js_name = "contains")]
    pub fn contains(&self, x: u32, y: u32) -> bool {
        self.selection
            .might_contain_xy(x as i64, y as i64, &self.context)
    }

    #[wasm_bindgen(js_name = "getRanges")]
    pub fn get_ranges(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection.ranges).map_err(|e| e.to_string())
    }

    // may be useful if we decide to show a selection on a chart
    // #[wasm_bindgen(js_name = "getChartSelections")]
    // pub fn chart_selections(&self, context: &str) -> Result<String, String> {
    //     let Ok(context) = serde_json::from_str::<A1Context>(context) else {
    //         return Err("Unable to parse context".to_string());
    //     };
    //     let chart_names = self
    //         .selection
    //         .ranges
    //         .iter()
    //         .filter_map(|range| {
    //             if let CellRefRange::Table { range } = range {
    //                 if let Some(t) = context.try_table(range.table_name.as_str()) {
    //                     if t.is_html_image {
    //                         return Some(t.table_name.clone());
    //                     }
    //                 }
    //             }
    //             None
    //         })
    //         .collect::<Vec<_>>();
    //     serde_json::to_string(&chart_names).map_err(|e| e.to_string())
    // }

    #[wasm_bindgen(js_name = "getFiniteRefRangeBounds")]
    pub fn finite_ref_range_bounds(&self) -> Result<JsValue, String> {
        let ranges = self
            .selection
            .ranges
            .iter()
            .filter(|r| r.is_finite())
            .filter_map(|range| match range {
                CellRefRange::Sheet { range } => Some(*range),
                CellRefRange::Table { range } => {
                    // we ignore charts because their selection needs to match
                    // up with their pixel-perfect borders
                    if self
                        .context
                        .try_table(range.table_name.as_str())
                        .is_some_and(|t| t.is_html_image)
                    {
                        return None;
                    }
                    range.convert_to_ref_range_bounds(false, &self.context, false, false)
                }
            })
            .collect::<Vec<_>>();
        serde_wasm_bindgen::to_value(&ranges).map_err(|e| e.to_string())
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
    pub fn overlaps_a1_selection(&self, selection: &str) -> Result<bool, String> {
        let selection =
            serde_json::from_str::<A1Selection>(selection).map_err(|e| e.to_string())?;
        Ok(self
            .selection
            .overlaps_a1_selection(&selection, &self.context))
    }

    #[wasm_bindgen(js_name = "bottomRightCell")]
    pub fn bottom_right_cell(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.last_selection_end(&self.context).x as u32,
            y: self.selection.last_selection_end(&self.context).y as u32,
        }
    }

    #[wasm_bindgen(js_name = "isAllSelected")]
    pub fn is_all_selected(&self) -> bool {
        self.selection.is_all_selected()
    }

    #[wasm_bindgen(js_name = "isSelectedColumnsFinite")]
    pub fn is_selected_columns_finite(&self) -> bool {
        self.selection.is_selected_columns_finite(&self.context)
    }

    #[wasm_bindgen(js_name = "isSelectedRowsFinite")]
    pub fn is_selected_rows_finite(&self) -> bool {
        self.selection.is_selected_rows_finite(&self.context)
    }

    #[wasm_bindgen(js_name = "getSelectedColumns")]
    pub fn get_selected_columns(&self) -> Vec<u32> {
        self.selection
            .selected_columns_finite(&self.context)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRows")]
    pub fn get_selected_rows(&self) -> Vec<u32> {
        self.selection
            .selected_rows_finite(&self.context)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedColumnRanges")]
    pub fn get_selected_column_ranges(&self, from: u32, to: u32) -> Vec<u32> {
        self.selection
            .selected_column_ranges(from as i64, to as i64, &self.context)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRowRanges")]
    pub fn get_selected_row_ranges(&self, from: u32, to: u32) -> Vec<u32> {
        self.selection
            .selected_row_ranges(from as i64, to as i64, &self.context)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "hasOneColumnRowSelection")]
    pub fn has_one_column_row_selection(&self, one_cell: bool) -> bool {
        self.selection.has_one_column_row_selection(one_cell)
    }

    #[wasm_bindgen(js_name = "isSingleSelection")]
    pub fn is_single_selection(&self) -> bool {
        self.selection.is_single_selection()
    }

    #[wasm_bindgen(js_name = "isMultiCursor")]
    pub fn is_multi_cursor(&self) -> bool {
        self.selection.is_multi_cursor(&self.context)
    }

    #[wasm_bindgen(js_name = "toA1String")]
    pub fn to_string(&self, default_sheet_id: String) -> Result<String, String> {
        let default_sheet_id = SheetId::from_str(&default_sheet_id).map_err(|e| e.to_string())?;
        Ok(self
            .selection
            .to_string(Some(default_sheet_id), &self.context))
    }

    #[wasm_bindgen(js_name = "cursorIsOnHtmlImage")]
    pub fn cursor_is_on_html_image(&self) -> bool {
        self.selection.cursor_is_on_html_image(&self.context)
    }

    #[wasm_bindgen(js_name = "getSelectedTableNames")]
    pub fn get_selected_table_names(&self) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(&self.selection.selected_table_names())
            .map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getTableColumnSelection")]
    pub fn get_table_column_selection(&self, table_name: &str) -> JsValue {
        self.selection
            .table_column_selection(table_name, &self.context)
            .map_or(JsValue::UNDEFINED, |cols| {
                serde_wasm_bindgen::to_value(&cols).unwrap_or(JsValue::UNDEFINED)
            })
    }

    #[wasm_bindgen(js_name = "getSingleFullTableSelectionName")]
    pub fn get_single_full_table_selection_name(&self) -> Option<String> {
        self.selection.get_single_full_table_selection_name()
    }
}
