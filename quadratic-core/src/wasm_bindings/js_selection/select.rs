//! RefRangeBounds selection methods, eg, selectRow, selectColumn, moveTo, etc.

use wasm_bindgen::prelude::*;

use crate::grid::js_types::Direction;
use crate::wasm_bindings::merge_cells::JsMergeCells;

use super::*;

#[wasm_bindgen]
impl JsSelection {
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
        context: &JsA1Context,
    ) {
        self.selection.select_column(
            column as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            top as i64,
            context.get_context(),
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
        context: &JsA1Context,
    ) {
        self.selection.select_row(
            row as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            left as i64,
            context.get_context(),
        );
    }

    #[wasm_bindgen(js_name = "selectRect")]
    pub fn select_rect(&mut self, left: u32, top: u32, right: u32, bottom: u32, append: bool) {
        self.selection
            .select_rect(left as i64, top as i64, right as i64, bottom as i64, append);
    }

    #[wasm_bindgen(js_name = "keyboardSelectTo")]
    pub fn keyboard_select_to(
        &mut self,
        x: i32,
        y: i32,
        context: &JsA1Context,
        merge_cells: &JsMergeCells,
    ) {
        self.selection.keyboard_select_to(
            x as i64,
            y as i64,
            context.get_context(),
            merge_cells.get_merge_cells(),
        );
    }

    #[wasm_bindgen(js_name = "keyboardJumpSelectTo")]
    pub fn keyboard_jump_select_to(
        &mut self,
        col: u32,
        row: u32,
        direction: Direction,
        context: &JsA1Context,
        merge_cells: &JsMergeCells,
    ) {
        self.selection.keyboard_jump_select_to(
            col as i64,
            row as i64,
            direction,
            context.get_context(),
            merge_cells.get_merge_cells(),
        );
    }

    #[wasm_bindgen(js_name = "selectTo")]
    pub fn select_to(
        &mut self,
        x: u32,
        y: u32,
        append: bool,
        context: &JsA1Context,
        merge_cells: &JsMergeCells,
    ) {
        self.selection.select_to(
            x as i64,
            y as i64,
            append,
            context.get_context(),
            merge_cells.get_merge_cells(),
        );
    }

    #[wasm_bindgen(js_name = "moveTo")]
    pub fn move_to(&mut self, x: u32, y: u32, append: bool, merge_cells: &JsMergeCells) {
        self.selection
            .move_to(x as i64, y as i64, append, merge_cells.get_merge_cells());
    }

    #[wasm_bindgen(js_name = "setColumnsSelected")]
    pub fn set_columns_selected(&mut self, context: &JsA1Context) {
        self.selection.set_columns_selected(context.get_context());
    }

    #[wasm_bindgen(js_name = "setRowsSelected")]
    pub fn set_rows_selected(&mut self, context: &JsA1Context) {
        self.selection.set_rows_selected(context.get_context());
    }

    #[wasm_bindgen(js_name = "selectTable")]
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        screen_col_left: i32,
        shift_key: bool,
        ctrl_key: bool,
        context: &JsA1Context,
    ) {
        self.selection.select_table(
            table_name,
            col,
            context.get_context(),
            screen_col_left as i64,
            shift_key,
            ctrl_key,
        );
    }

    #[wasm_bindgen(js_name = "checkForTableRef")]
    pub fn check_for_table_ref(&mut self, sheet_id: String, context: &JsA1Context) {
        if let Ok(sheet_id) = SheetId::from_str(&sheet_id) {
            for range in self.selection.ranges.iter_mut() {
                if let Some(new_range) = range.check_for_table_ref(sheet_id, context.get_context())
                {
                    *range = new_range;
                }
            }
        }
    }

    #[wasm_bindgen(js_name = "selectSheet")]
    pub fn select_sheet(&mut self, sheet_id: String) -> Result<(), String> {
        self.selection.select_sheet(sheet_id)
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;
    use crate::a1::A1Context;
    use crate::grid::sheet::merge_cells::MergeCells;

    #[test]
    fn test_select_in_direction_left_with_merged_cell() {
        // Test that keyboard_select_to properly handles merged cells when selecting left.
        // This tests the basic merged cell selection functionality.
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();

        // Merge B3:E3 (columns 2-5, row 3)
        merge_cells.merge_cells(Rect::test_a1("B3:E3"));

        // Start at F3 (to the right of the merged cell)
        let mut selection = crate::a1::A1Selection::test_a1("F3");

        // Verify initial selection is F3
        let sel_string = selection.test_to_string();
        assert_eq!(sel_string, "F3");

        // Move left once - should expand selection to E3:F3
        // Since E3 is part of merged cell B3:E3, selection should expand to include it
        selection.keyboard_select_to(-1, 0, &context, &merge_cells);
        let sel_string = selection.test_to_string();
        // When we select left into the merged cell, it expands to include the full merged cell
        assert_eq!(sel_string, "B3:F3");
    }
}
