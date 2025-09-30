//! Wrapper around A1Selection for use in JS rust calls.

use std::str::FromStr;

use wasm_bindgen::prelude::*;

use crate::{
    Pos, Rect, SheetRect,
    a1::A1Selection,
    grid::{DataTable, Sheet, SheetId, js_types::JsCoordinate},
    wasm_bindings::js_a1_context::JsA1Context,
};

pub mod create;
pub mod query;
pub mod select;
pub mod validate_name;

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

impl JsSelection {
    pub(crate) fn get_selection(&self) -> &A1Selection {
        &self.selection
    }
}

#[wasm_bindgen]
impl JsSelection {
    #[wasm_bindgen(js_name = "excludeCells")]
    pub fn exclude_cells(&mut self, x0: u32, y0: u32, x1: u32, y1: u32, context: &JsA1Context) {
        self.selection.exclude_cells(
            Pos::new(x0 as i64, y0 as i64),
            Some(Pos::new(x1 as i64, y1 as i64)),
            context.get_context(),
        );
    }

    #[wasm_bindgen(js_name = "updateTableName")]
    pub fn update_table_name(&mut self, old_name: String, new_name: String) {
        self.selection.replace_table_name(&old_name, &new_name);
    }

    #[wasm_bindgen(js_name = "updateColumnName")]
    pub fn update_column_name(&mut self, table_name: String, old_name: String, new_name: String) {
        self.selection
            .replace_column_name(&table_name, &old_name, &new_name);
    }

    #[wasm_bindgen(js_name = "getTableNameFromPos")]
    pub fn get_table_from_pos(
        &self,
        sheet_id: &str,
        col: u32,
        row: u32,
        context: &JsA1Context,
    ) -> Option<String> {
        let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
            return None;
        };
        let pos = Pos::new(col as i64, row as i64);
        let table = context
            .get_context()
            .table_from_pos(pos.as_sheet_pos(sheet_id));
        table.map(|t| t.table_name.to_string())
    }

    #[wasm_bindgen(js_name = "selectionToSheetRect")]
    pub fn selection_to_sheet_rect(
        &self,
        sheet_id: &str,
        selection: &str,
        context: &JsA1Context,
    ) -> Result<String, String> {
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
        let selection = A1Selection::parse_a1(selection, sheet_id, context.get_context())
            .map_err(|e| format!("Invalid selection: {e}"))?;
        let range = selection
            .ranges
            .first()
            .ok_or("Invalid selection: no ranges")?;
        let rect = range
            .as_rect(context.get_context())
            .ok_or("Invalid selection: not a rectangle")?;
        let sheet_rect = rect.to_sheet_rect(sheet_id);
        serde_json::to_string(&sheet_rect).map_err(|e| e.to_string())
    }
}
