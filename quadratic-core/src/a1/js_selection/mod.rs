//! Wrapper around A1Selection for use in JS rust calls.

use std::str::FromStr;

use ts_rs::TS;
use wasm_bindgen::prelude::*;

use crate::{
    Pos, Rect, SheetRect,
    a1::{A1Context, A1Selection},
    grid::{DataTable, Sheet, SheetId},
};

pub mod create;
pub mod query;
pub mod select;
pub mod validate_name;

#[derive(Debug, Clone, TS)]
#[wasm_bindgen]
pub struct JsCoordinate {
    pub x: u32,
    pub y: u32,
}

#[wasm_bindgen]
pub struct JsSelection {
    selection: A1Selection,
    context: A1Context,
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
    #[wasm_bindgen(js_name = "updateContext")]
    pub fn update_context(&mut self, context: &[u8]) {
        match A1Context::from_bytes(context) {
            Ok(context) => self.context = context,
            Err(e) => {
                dbgjs!(format!(
                    "[update_context] Error deserializing A1Context: {:?}",
                    e
                ));
            }
        }
    }

    #[wasm_bindgen(js_name = "excludeCells")]
    pub fn exclude_cells(&mut self, x0: u32, y0: u32, x1: u32, y1: u32) {
        self.selection.exclude_cells(
            Pos::new(x0 as i64, y0 as i64),
            Some(Pos::new(x1 as i64, y1 as i64)),
            &self.context,
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

    #[wasm_bindgen(js_name = "hideColumn")]
    pub fn hide_column(&mut self, table_name: String, column_name: String) {
        self.context.hide_column(&table_name, &column_name);
    }

    #[wasm_bindgen(js_name = "getTableInfo")]
    pub fn table_names(&self) -> Result<JsValue, String> {
        let table_info = self.context.table_info();
        serde_wasm_bindgen::to_value(&table_info).map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "getTableNameFromPos")]
    pub fn get_table_from_pos(&self, sheet_id: &str, col: u32, row: u32) -> Option<String> {
        let Ok(sheet_id) = SheetId::from_str(sheet_id) else {
            return None;
        };
        let pos = Pos::new(col as i64, row as i64);
        let table = self.context.table_from_pos(pos.to_sheet_pos(sheet_id));
        table.map(|t| t.table_name.to_string())
    }

    /// Converts a table reference to an A1 range.
    #[wasm_bindgen(js_name = "convertTableToRange")]
    pub fn convert_table_to_range(
        &self,
        table_name: &str,
        current_sheet_id: &str,
    ) -> Result<String, String> {
        let sheet_id =
            SheetId::from_str(current_sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
        self.context
            .convert_table_to_range(table_name, sheet_id)
            .map_err(|e| e.to_string())
    }

    #[wasm_bindgen(js_name = "selectionToSheetRect")]
    pub fn selection_to_sheet_rect(
        &self,
        sheet_id: &str,
        selection: &str,
    ) -> Result<String, String> {
        let sheet_id = SheetId::from_str(sheet_id).map_err(|e| format!("Sheet not found: {e}"))?;
        let selection = A1Selection::parse_a1(selection, sheet_id, &self.context)
            .map_err(|e| format!("Invalid selection: {e}"))?;
        let range = selection
            .ranges
            .first()
            .ok_or("Invalid selection: no ranges")?;
        // we don't really need the context here, but we need to pass something
        let context = A1Context::default();
        let rect = range
            .to_rect(&context)
            .ok_or("Invalid selection: not a rectangle")?;
        let sheet_rect = rect.to_sheet_rect(sheet_id);
        serde_json::to_string(&sheet_rect).map_err(|e| e.to_string())
    }
}
