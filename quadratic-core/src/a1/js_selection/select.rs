//! RefRangeBounds selection methods, eg, selectRow, selectColumn, moveTo, etc.

use wasm_bindgen::prelude::*;

use crate::a1::A1Context;

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
        context: &str,
    ) {
        let Ok(context) = serde_json::from_str::<A1Context>(context) else {
            return;
        };
        self.selection.select_column(
            column as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            top as i64,
            &context,
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
        context: &str,
    ) {
        let Ok(context) = serde_json::from_str::<A1Context>(context) else {
            return;
        };
        self.selection.select_row(
            row as i64,
            ctrl_key || shift_key,
            shift_key,
            is_right_click,
            left as i64,
            &context,
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

    #[wasm_bindgen(js_name = "moveTo")]
    pub fn move_to(&mut self, x: u32, y: u32, append: bool) {
        self.selection.move_to(x as i64, y as i64, append);
    }

    #[wasm_bindgen(js_name = "setColumnsSelected")]
    pub fn set_columns_selected(&mut self, context: &str) {
        if let Ok(context) = serde_json::from_str::<A1Context>(context) {
            self.selection.set_columns_selected(&context);
        }
    }

    #[wasm_bindgen(js_name = "setRowsSelected")]
    pub fn set_rows_selected(&mut self, context: &str) {
        if let Ok(context) = serde_json::from_str::<A1Context>(context) {
            self.selection.set_rows_selected(&context);
        }
    }

    #[wasm_bindgen(js_name = "selectTable")]
    pub fn select_table(
        &mut self,
        table_name: &str,
        col: Option<String>,
        context: &str,
        screen_row_top: i32,
        shift_key: bool,
        ctrl_key: bool,
    ) {
        if let Ok(context) = serde_json::from_str::<A1Context>(context) {
            self.selection.select_table(
                table_name,
                col,
                &context,
                screen_row_top as i64,
                shift_key,
                ctrl_key,
            );
        }
    }
}
