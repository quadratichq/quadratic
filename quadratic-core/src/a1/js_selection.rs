use std::str::FromStr;

use ts_rs::TS;
use wasm_bindgen::prelude::*;

use crate::{grid::SheetId, Pos, Rect, SheetRect};

use super::{A1Selection, SheetNameIdMap};

#[derive(Debug, Clone, TS)]
#[wasm_bindgen]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct JsSelection {
    selection: A1Selection,
}

impl From<Pos> for JsCoordinate {
    fn from(pos: Pos) -> Self {
        JsCoordinate {
            x: pos.x as u32,
            y: pos.y as u32,
        }
    }
}

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(constructor)]
    pub fn new(sheet_id: String) -> Self {
        let sheet_id = SheetId::from_str(&sheet_id).unwrap();
        JsSelection {
            selection: A1Selection::from_xy(1, 1, sheet_id),
        }
    }

    #[wasm_bindgen(js_name = "getSheetId")]
    pub fn sheet_id(&self) -> String {
        self.selection.sheet_id.to_string()
    }

    /// Saves the selection to a JSON string.
    #[wasm_bindgen]
    pub fn save(&self) -> Result<String, String> {
        serde_json::to_string(&self.selection).map_err(|e| e.to_string())
    }

    /// Get A1Selection as a JsValue.
    #[wasm_bindgen]
    pub fn selection(&self) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(&self.selection).map_err(|e| e.to_string())
    }

    /// Loads the selection from a JSON string.
    #[wasm_bindgen]
    pub fn load(selection: String) -> Result<JsSelection, String> {
        let selection =
            serde_json::from_str::<A1Selection>(&selection).map_err(|e| e.to_string())?;
        Ok(JsSelection { selection })
    }

    /// Returns the cursor position (as a JsCoordinate)
    #[wasm_bindgen(js_name = "getCursor")]
    pub fn cursor(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.cursor.x as u32,
            y: self.selection.cursor.y as u32,
        }
    }

    #[wasm_bindgen(js_name = "getSelectionEnd")]
    pub fn get_selection_end(&self) -> JsCoordinate {
        self.selection.last_selection_end().into()
    }

    #[wasm_bindgen(js_name = "getBottomRightCell")]
    pub fn get_bottom_right_cell(&self) -> JsCoordinate {
        self.selection.bottom_right_cell().into()
    }

    /// Selects the entire sheet.
    #[wasm_bindgen(js_name = "selectAll")]
    pub fn select_all(&mut self, append: bool) {
        self.selection.select_all(append);
    }

    #[wasm_bindgen(js_name = "selectColumn")]
    pub fn select_column(
        &mut self,
        column: u32,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
        top: u32,
    ) {
        self.selection.select_column(
            column as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            top as i64,
        );
    }

    #[wasm_bindgen(js_name = "selectRow")]
    pub fn select_row(
        &mut self,
        row: u32,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
        left: u32,
    ) {
        self.selection.select_row(
            row as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            left as i64,
        );
    }

    #[wasm_bindgen(js_name = "selectRect")]
    pub fn select_rect(&mut self, left: u32, top: u32, right: u32, bottom: u32, append: bool) {
        self.selection
            .select_rect(left as i64, top as i64, right as i64, bottom as i64, append);
    }

    #[wasm_bindgen(js_name = "selectTo")]
    pub fn select_to(&mut self, x: u32, y: u32, append: bool) {
        self.selection.select_to(x as i64, y as i64, append);
    }

    #[wasm_bindgen(js_name = "toA1String")]
    pub fn to_string(&self, default_sheet_id: String, sheet_map: &str) -> Result<String, String> {
        let sheet_map =
            serde_json::from_str::<SheetNameIdMap>(sheet_map).map_err(|e| e.to_string())?;
        let default_sheet_id = SheetId::from_str(&default_sheet_id).map_err(|e| e.to_string())?;
        Ok(self.selection.to_string(Some(default_sheet_id), &sheet_map))
    }

    #[wasm_bindgen(js_name = "toCursorA1")]
    pub fn to_cursor_a1(&self) -> Result<String, String> {
        Ok(self.selection.to_cursor_a1())
    }

    #[wasm_bindgen(js_name = "moveTo")]
    pub fn move_to(&mut self, x: u32, y: u32, append: bool) {
        self.selection.move_to(x as i64, y as i64, append);
    }

    #[wasm_bindgen(js_name = "isMultiCursor")]
    pub fn is_multi_cursor(&self) -> bool {
        self.selection.is_multi_cursor()
    }

    #[wasm_bindgen(js_name = "setColumnsSelected")]
    pub fn set_columns_selected(&mut self) {
        self.selection.set_columns_selected();
    }

    #[wasm_bindgen(js_name = "setRowsSelected")]
    pub fn set_rows_selected(&mut self) {
        self.selection.set_rows_selected();
    }

    #[wasm_bindgen(js_name = "getLargestRectangle")]
    pub fn get_largest_rectangle(&self) -> Result<Rect, String> {
        Ok(self.selection.largest_rect())
    }

    #[wasm_bindgen(js_name = "getSingleRectangle")]
    pub fn get_single_rectangle(&self) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect())
    }

    #[wasm_bindgen(js_name = "getSingleRectangleOrCursor")]
    pub fn get_single_rectangle_or_cursor(&self) -> Result<Option<Rect>, String> {
        Ok(self.selection.single_rect_or_cursor())
    }

    #[wasm_bindgen(js_name = "contains")]
    pub fn contains(&self, x: u32, y: u32) -> bool {
        self.selection.might_contain_xy(x as i64, y as i64)
    }

    #[wasm_bindgen(js_name = "getRanges")]
    pub fn get_ranges(&self) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(&self.selection.ranges).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "isColumnRow")]
    pub fn is_column_row(&self) -> bool {
        self.selection.is_column_row()
    }

    #[wasm_bindgen(js_name = "overlapsA1Selection")]
    pub fn overlaps_a1_selection(&self, selection: String) -> Result<bool, String> {
        let selection =
            serde_json::from_str::<A1Selection>(&selection).map_err(|e| e.to_string())?;
        Ok(self.selection.overlaps_a1_selection(&selection))
    }

    #[wasm_bindgen(js_name = "bottomRightCell")]
    pub fn bottom_right_cell(&self) -> JsCoordinate {
        JsCoordinate {
            x: self.selection.last_selection_end().x as u32,
            y: self.selection.last_selection_end().y as u32,
        }
    }

    #[wasm_bindgen(js_name = "isSelectedColumnsFinite")]
    pub fn is_selected_columns_finite(&self) -> bool {
        self.selection.is_selected_columns_finite()
    }

    #[wasm_bindgen(js_name = "isSelectedRowsFinite")]
    pub fn is_selected_rows_finite(&self) -> bool {
        self.selection.is_selected_rows_finite()
    }

    #[wasm_bindgen(js_name = "getSelectedColumns")]
    pub fn get_selected_columns(&self) -> Vec<u32> {
        self.selection
            .selected_columns_finite()
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRows")]
    pub fn get_selected_rows(&self) -> Vec<u32> {
        self.selection
            .selected_rows_finite()
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedColumnRanges")]
    pub fn get_selected_column_ranges(&self, from: u32, to: u32) -> Vec<u32> {
        self.selection
            .selected_column_ranges(from as i64, to as i64)
            .iter()
            .map(|c| *c as u32)
            .collect()
    }

    #[wasm_bindgen(js_name = "getSelectedRowRanges")]
    pub fn get_selected_row_ranges(&self, from: u32, to: u32) -> Vec<u32> {
        self.selection
            .selected_row_ranges(from as i64, to as i64)
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

    #[wasm_bindgen(js_name = "excludeCells")]
    pub fn exclude_cells(&mut self, x0: u32, y0: u32, x1: u32, y1: u32) {
        self.selection.exclude_cells(
            Pos::new(x0 as i64, y0 as i64),
            Some(Pos::new(x1 as i64, y1 as i64)),
        );
    }
}

#[wasm_bindgen(js_name = "stringToSelection")]
pub fn to_selection(
    a1: &str,
    default_sheet_id: &str,
    sheet_map: &str,
) -> Result<JsSelection, String> {
    let default_sheet_id = SheetId::from_str(default_sheet_id).map_err(|e| e.to_string())?;
    let sheet_map = serde_json::from_str::<SheetNameIdMap>(sheet_map).map_err(|e| e.to_string())?;
    let selection = A1Selection::from_str(a1, &default_sheet_id, &sheet_map)?;
    Ok(JsSelection { selection })
}

#[wasm_bindgen(js_name = "newSingleSelection")]
pub fn new_single_selection(sheet_id: String, x: u32, y: u32) -> Result<JsSelection, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    Ok(JsSelection {
        selection: A1Selection::from_xy(x as i64, y as i64, sheet_id),
    })
}

#[wasm_bindgen(js_name = "newRectSelection")]
pub fn new_rect_selection(
    sheet_id: String,
    x0: i64,
    y0: i64,
    x1: i64,
    y1: i64,
) -> Result<JsSelection, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    let sheet_rect = SheetRect::new(x0, y0, x1, y1, sheet_id);
    Ok(JsSelection {
        selection: A1Selection::from_rect(sheet_rect),
    })
}

#[wasm_bindgen(js_name = "newAllSelection")]
pub fn new_all_selection(sheet_id: String) -> Result<JsSelection, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    Ok(JsSelection {
        selection: A1Selection::all(sheet_id),
    })
}

#[wasm_bindgen(js_name = "A1SelectionStringToSelection")]
pub fn a1_selection_string_to_selection(a1_selection: &str) -> Result<JsSelection, String> {
    let selection = serde_json::from_str::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    Ok(JsSelection { selection })
}

#[wasm_bindgen(js_name = "A1SelectionValueToSelection")]
pub fn a1_selection_value_to_selection(a1_selection: JsValue) -> Result<JsSelection, String> {
    let selection =
        serde_wasm_bindgen::from_value::<A1Selection>(a1_selection).map_err(|e| e.to_string())?;
    Ok(JsSelection { selection })
}

#[wasm_bindgen(js_name = "xyToA1")]
pub fn xy_to_a1(x: i64, y: i64) -> Result<String, String> {
    let pos = Pos::new(x, y);
    Ok(pos.a1_string())
}

#[wasm_bindgen(js_name = "xyxyToA1")]
pub fn xyxy_to_a1(x0: i64, y0: i64, x1: i64, y1: i64) -> Result<String, String> {
    let rect = Rect::new(x0, y0, x1, y1);
    Ok(rect.a1_string())
}

#[wasm_bindgen(js_name = "rectToA1")]
pub fn rect_to_a1(rect: JsValue) -> Result<String, String> {
    let rect = serde_wasm_bindgen::from_value::<Rect>(rect).map_err(|e| e.to_string())?;
    Ok(rect.a1_string())
}
